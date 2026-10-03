import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "jsr:@panva/jose@6";

const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

const clients=()=>{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)throw new Error("Supabase server configuration is missing");
  return {auth:createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}}),admin:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
};

async function accessToken(scopes:string[]){
  const raw=Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"),subject=Deno.env.get("GOOGLE_WORKSPACE_IMPERSONATE_EMAIL");
  if(!raw||!subject)throw new Error("Google Calendar is not connected");
  const service=JSON.parse(raw),now=Math.floor(Date.now()/1000),key=await importPKCS8(service.private_key,"RS256");
  const assertion=await new SignJWT({scope:scopes.join(" "),sub:subject}).setProtectedHeader({alg:"RS256",typ:"JWT"}).setIssuer(service.client_email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now+3600).sign(key);
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const d=await r.json();if(!r.ok)throw new Error(d?.error_description||d?.error||"Google token request failed");return d.access_token as string;
}

async function gfetch(path:string,token:string,init:RequestInit={}){
  const r=await fetch(`https://www.googleapis.com/calendar/v3${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(init.headers||{})}});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||"Google Calendar request failed");return d;
}

const overlaps=(b:{start:string;end:string},s:string,e:string)=>new Date(b.start).getTime()<new Date(e).getTime()&&new Date(b.end).getTime()>new Date(s).getTime();

async function resolveCalendars(admin:any,userIds:string[]){
  const {data:maps,error}=await admin.from("schedule_calendar_mappings").select("user_id,calendar_id,calendar_email,enabled").eq("provider","google").eq("enabled",true);
  if(error)throw error;
  const mappingByUser=new Map((maps||[]).filter((m:any)=>m.user_id).map((m:any)=>[m.user_id,m]));
  const {data:profiles,error:profileError}=await admin.from("profiles").select("id,email,full_name").in("id",userIds);
  if(profileError)throw profileError;
  const result:any[]=[];
  for(const id of userIds){
    const m=mappingByUser.get(id),p=(profiles||[]).find((x:any)=>x.id===id);
    if(m)result.push(m);
    else if(p?.email)result.push({user_id:id,calendar_id:p.email,calendar_email:p.email,enabled:true});
  }
  const masterId=Deno.env.get("GOOGLE_MASTER_CALENDAR_ID");
  const masterEmail=Deno.env.get("GOOGLE_MASTER_CALENDAR_EMAIL")||masterId;
  if(masterId)result.push({user_id:null,calendar_id:masterId,calendar_email:masterEmail,enabled:true});
  return result;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!bearer)return json({error:"Authentication required"},401);
  try{
    const {auth,admin}=clients(),{data:userData,error:userError}=await auth.auth.getUser(bearer);
    if(userError||!userData.user)return json({error:"Invalid or expired session"},401);
    const payload=await req.json().catch(()=>({})),action=String(payload.action||"status");
    const configured=Boolean(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")&&Deno.env.get("GOOGLE_WORKSPACE_IMPERSONATE_EMAIL"));

    if(action==="status"){
      const masterId=Deno.env.get("GOOGLE_MASTER_CALENDAR_ID");
      return json({configured,master_calendar_configured:Boolean(masterId),master_calendar_id:masterId||null,message:configured&&masterId?"Google Calendar is ready for availability and booking":"Google Calendar credentials or master calendar are not fully configured"});
    }

    if(!configured)return json({configured:false,error:"Google Calendar is not connected. Configure the Google service-account secret and Workspace impersonation first."},503);

    if(action==="availability"){
      const start=String(payload.start||""),end=String(payload.end||""),userIds=[...new Set((payload.user_ids||[]).filter(Boolean))];
      if(!start||!end||!userIds.length)return json({error:"start, end and user_ids are required"},400);
      const calendars=await resolveCalendars(admin,userIds);
      if(!calendars.length)return json({configured:true,available:false,reason:"No employee calendars could be resolved"},400);
      const token=await accessToken(["https://www.googleapis.com/auth/calendar.freebusy"]);
      const fb=await gfetch("/freeBusy",token,{method:"POST",body:JSON.stringify({timeMin:start,timeMax:end,timeZone:"Asia/Kolkata",calendarExpansionMax:50,items:calendars.map((c:any)=>({id:c.calendar_id}))})});
      const busy:any[]=[];
      for(const c of calendars)for(const b of (fb.calendars?.[c.calendar_id]?.busy||[]))busy.push({...b,user_id:c.user_id,calendar_email:c.calendar_email});
      return json({configured:true,available:busy.length===0,calendars:calendars.map((c:any)=>({user_id:c.user_id,calendar_id:c.calendar_id,calendar_email:c.calendar_email,busy:fb.calendars?.[c.calendar_id]?.busy||[]})),busy});
    }

    if(action==="create_event"){
      const scheduleId=String(payload.schedule_id||"");if(!scheduleId)return json({error:"schedule_id is required"},400);
      const {data:s,error:sError}=await admin.from("schedules").select("*").eq("id",scheduleId).single();if(sError||!s)return json({error:"Schedule not found"},404);
      if(s.google_calendar_status==="synced"&&s.google_calendar_event_id)return json({success:true,already_synced:true,event_id:s.google_calendar_event_id,event_url:s.google_calendar_url});
      const {data:parts,error:pError}=await admin.from("schedule_participants").select("user_id,is_required").eq("schedule_id",scheduleId);if(pError)throw pError;
      const ids=[...new Set([s.owner_id,...(parts||[]).filter((p:any)=>p.is_required).map((p:any)=>p.user_id)].filter(Boolean))];
      const calendars=await resolveCalendars(admin,ids);if(!calendars.length)return json({error:"No Google Calendar mappings configured for this meeting"},400);
      const start=String(s.start_at),end=String(s.end_at||"");if(!end)return json({error:"Schedule end time is required"},400);
      const token=await accessToken(["https://www.googleapis.com/auth/calendar.freebusy","https://www.googleapis.com/auth/calendar.events"]);
      const fb=await gfetch("/freeBusy",token,{method:"POST",body:JSON.stringify({timeMin:start,timeMax:end,timeZone:s.timezone||"Asia/Kolkata",calendarExpansionMax:50,items:calendars.map((c:any)=>({id:c.calendar_id}))})});
      const blocking:any[]=[];for(const c of calendars)for(const b of (fb.calendars?.[c.calendar_id]?.busy||[]))if(overlaps(b,start,end))blocking.push({...b,user_id:c.user_id,calendar_email:c.calendar_email});
      if(blocking.length){await admin.from("schedules").update({google_calendar_status:"failed"}).eq("id",scheduleId);return json({error:"Selected time is no longer available",code:"SLOT_CONFLICT",blocking},409);}
      const master=calendars.find((c:any)=>c.user_id===null);if(!master)return json({error:"Company master calendar is not configured"},400);
      const attendees=calendars.filter((c:any)=>c.user_id!==null&&c.calendar_email).map((c:any)=>({email:c.calendar_email}));
      const body:any={id:`sankalp${scheduleId.replaceAll("-","")}`.slice(0,1024),summary:s.title,description:s.description||"",location:s.location_address||"",start:{dateTime:start,timeZone:s.timezone||"Asia/Kolkata"},end:{dateTime:end,timeZone:s.timezone||"Asia/Kolkata"},attendees,extendedProperties:{private:{sankalp_schedule_id:scheduleId,sankalp_lead_id:s.lead_id||""}}};
      if(s.mode==="digital")body.conferenceData={createRequest:{requestId:`meet-${scheduleId}`,conferenceSolutionKey:{type:"hangoutsMeet"}}};
      const event=await gfetch(`/calendars/${encodeURIComponent(master.calendar_id)}/events?conferenceDataVersion=${s.mode==="digital"?1:0}&sendUpdates=all`,token,{method:"POST",body:JSON.stringify(body)});
      const meet=event.conferenceData?.entryPoints?.find((e:any)=>e.entryPointType==="video")?.uri||null;
      const {error:uError}=await admin.from("schedules").update({google_calendar_event_id:event.id,google_calendar_status:"synced",google_calendar_url:event.htmlLink||null,meeting_link:s.mode==="digital"?(meet||s.meeting_link):s.meeting_link}).eq("id",scheduleId);if(uError)throw uError;
      return json({success:true,event_id:event.id,event_url:event.htmlLink||null,meeting_link:meet});
    }
    return json({error:"Unsupported action"},400);
  }catch(e){console.error("google-calendar error",e);return json({error:e instanceof Error?e.message:"Google Calendar operation failed"},500);}
});
