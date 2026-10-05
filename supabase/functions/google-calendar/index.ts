import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const adminClient=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
const fromB64=(s:string)=>{const x=s.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-s.length%4)%4);return Uint8Array.from(atob(x),c=>c.charCodeAt(0))};
const toB64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
const key=async()=>{const secret=Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");if(!secret)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");const normalized=secret.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-secret.length%4)%4);let bytes;try{bytes=Uint8Array.from(atob(normalized),c=>c.charCodeAt(0))}catch{bytes=new TextEncoder().encode(secret)}if(bytes.length!==32)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"])};
const decrypt=async(v:string)=>{const [i,d]=v.split(".");const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(i)},await key(),fromB64(d));return new TextDecoder().decode(p)};
const encrypt=async(v:string)=>{const iv=new Uint8Array(12);crypto.getRandomValues(iv);const d=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(v)));return toB64(iv)+"."+toB64(d)};
const overlaps=(b:any,s:string,e:string)=>new Date(b.start).getTime()<new Date(e).getTime()&&new Date(b.end).getTime()>new Date(s).getTime();

async function tokenFor(admin:any,userId:string){
 const {data:c,error}=await admin.from("google_calendar_connections").select("*").eq("user_id",userId).maybeSingle();
 if(error)throw error;if(!c?.refresh_token_encrypted)throw new Error("Google Calendar is not connected for this employee");
 if(c.access_token_encrypted&&c.token_expires_at&&new Date(c.token_expires_at).getTime()>Date.now()+120000)return {token:await decrypt(c.access_token_encrypted),connection:c};
 const refresh=await decrypt(c.refresh_token_encrypted),clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");if(!clientId||!clientSecret)throw new Error("Google OAuth client is not configured");
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})});
 const d=await r.json();if(!r.ok){await admin.from("google_calendar_connections").update({status:"error",last_error:d?.error_description||d?.error||"Token refresh failed"}).eq("user_id",userId);throw new Error(d?.error_description||d?.error||"Google token refresh failed")};
 await admin.from("google_calendar_connections").update({access_token_encrypted:await encrypt(d.access_token),token_expires_at:new Date(Date.now()+Number(d.expires_in||3600)*1000).toISOString(),status:"connected",last_error:null,last_synced_at:new Date().toISOString()}).eq("user_id",userId);
 return {token:d.access_token,connection:c};
}
async function gfetch(path:string,token:string,init:RequestInit={}){const r=await fetch("https://www.googleapis.com/calendar/v3"+path,{...init,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||"Google Calendar request failed");return d}
async function masterInfo(admin:any){
 const {data:m,error}=await admin.from("google_calendar_master_connections").select("*").eq("status","connected").maybeSingle();
 if(error)throw error;if(!m)throw new Error("Sankalp Company Master Calendar is not connected. Connect it from Admin > Calendar Settings.");
 if(m.access_token_encrypted&&m.token_expires_at&&new Date(m.token_expires_at).getTime()>Date.now()+120000)return {...m,token:await decrypt(m.access_token_encrypted)};
 if(!m.refresh_token_encrypted)throw new Error("Sankalp Company Master Calendar needs to be reconnected.");
 const refresh=await decrypt(m.refresh_token_encrypted),clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");if(!clientId||!clientSecret)throw new Error("Google OAuth client is not configured");
 const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})});
 const d=await rr.json();if(!rr.ok){await admin.from("google_calendar_master_connections").update({status:"error",last_error:d?.error_description||d?.error||"Token refresh failed"}).eq("id",m.id);throw new Error(d?.error_description||d?.error||"Company Master Calendar token refresh failed")}
 await admin.from("google_calendar_master_connections").update({access_token_encrypted:await encrypt(d.access_token),token_expires_at:new Date(Date.now()+Number(d.expires_in||3600)*1000).toISOString(),status:"connected",last_error:null,last_synced_at:new Date().toISOString()}).eq("id",m.id);
 return {...m,token:d.access_token}
}
async function userCalendar(admin:any,userId:string){const t=await tokenFor(admin,userId);return {user_id:userId,calendar_id:t.connection.primary_calendar_id||"primary",calendar_email:t.connection.google_email,token:t.token}}
async function requiredUsers(admin:any,scheduleId:string){const {data:s,error}=await admin.from("schedules").select("owner_id").eq("id",scheduleId).single();if(error)throw error;const {data:p}=await admin.from("schedule_participants").select("user_id,is_required").eq("schedule_id",scheduleId).eq("is_required",true);return [...new Set([s.owner_id,...(p||[]).map((x:any)=>x.user_id)].filter(Boolean))]}
async function freeBusy(calendar:any,start:string,end:string){return gfetch("/freeBusy",calendar.token,{method:"POST",body:JSON.stringify({timeMin:start,timeMax:end,timeZone:"Asia/Kolkata",calendarExpansionMax:50,items:[{id:calendar.calendar_id}]})})}
async function connectedUserCalendars(admin:any,ids:string[]){const out:any[]=[];for(const id of ids){try{out.push(await userCalendar(admin,id))}catch(e){out.push({user_id:id,connected:false,error:e instanceof Error?e.message:"Calendar not connected"})}}return out}
async function upsertSync(admin:any,scheduleId:string,userId:string,status:string,error:string|null=null,eventId:string|null=null){await admin.from("schedule_calendar_sync_items").upsert({schedule_id:scheduleId,user_id:userId,provider:"google",calendar_type:"personal",google_event_id:eventId,sync_status:status,last_synced_at:status==="synced"?new Date().toISOString():null,last_error:error,last_source:"bms",updated_at:new Date().toISOString()},{onConflict:"schedule_id,user_id,provider,calendar_type"})}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!bearer)return json({error:"Authentication required"},401);
 try{
  const admin=adminClient(),{data:u,error:ue}=await admin.auth.getUser(bearer);if(ue||!u.user)return json({error:"Invalid or expired session"},401);
  const payload=await req.json().catch(()=>({})),action=String(payload.action||"status");
  if(action==="status"){const {data:c}=await admin.from("google_calendar_connections").select("google_email,status,connected_at,last_synced_at,last_error").eq("user_id",u.user.id).maybeSingle();const {data:m}=await admin.from("google_calendar_master_connections").select("google_email,calendar_id,calendar_email,status,connected_at,last_synced_at,last_error").maybeSingle();return json({configured:c?.status==="connected",employee_connection:c||null,master_calendar_configured:Boolean(m?.status==="connected"),master_calendar:m?{calendar_id:m.calendar_id,calendar_email:m.calendar_email,google_email:m.google_email,status:m.status,connected_at:m.connected_at,last_error:m.last_error}:null})}
  if(action==="sync_pending"){
    const {data:pending,error:pe}=await admin.from("schedule_calendar_sync_items").select("id,schedule_id,user_id,google_event_id").eq("user_id",u.user.id).in("sync_status",["pending","failed","synced"]).order("updated_at",{ascending:true}).limit(100);
    if(pe)throw pe;
    const master=await masterInfo(admin);
    const personal=await tokenFor(admin,u.user.id);
    const connectedEmail=String(personal.connection.google_email||"").trim().toLowerCase();
    const {data:profile}=await admin.from("profiles").select("email").eq("id",u.user.id).single();
    const profileEmail=String(profile?.email||"").trim().toLowerCase();
    if(!connectedEmail)return json({error:"Connected Google Calendar email is missing"},400);
    let synced=0,failed=0;
    for(const item of pending||[]){
      try{
        if(!item.google_event_id){failed++;continue;}
        const event=await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(item.google_event_id),master.token);
        const attendees=(event.attendees||[]).filter((a:any)=>{
          const email=String(a.email||"").toLowerCase();
          return !profileEmail || email!==profileEmail || email===connectedEmail;
        });
        const existing=new Set(attendees.map((a:any)=>String(a.email||"").toLowerCase()).filter(Boolean));
        if(!existing.has(connectedEmail))attendees.push({email:personal.connection.google_email});
        await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(item.google_event_id)+"?sendUpdates=all",master.token,{method:"PATCH",body:JSON.stringify({attendees})});
        await admin.from("schedule_calendar_sync_items").update({sync_status:"synced",last_synced_at:new Date().toISOString(),last_error:null,last_source:"manual_or_auto_sync",updated_at:new Date().toISOString()}).eq("id",item.id);
        synced++;
      }catch(e){
        await admin.from("schedule_calendar_sync_items").update({sync_status:"failed",last_error:e instanceof Error?e.message:"Calendar sync failed",last_source:"manual_or_auto_sync",updated_at:new Date().toISOString()}).eq("id",item.id);
        failed++;
      }
    }
    return json({success:true,synced,failed,pending:(pending||[]).length-synced-failed});
  }
  if(action==="availability"){const start=String(payload.start||""),end=String(payload.end||""),ids=[...new Set((payload.user_ids||[]).filter(Boolean))];if(!start||!end||!ids.length)return json({error:"start, end and user_ids are required"},400);const calendars=await connectedUserCalendars(admin,ids);const master=await masterInfo(admin);const connected=calendars.filter((x:any)=>x.connected!==false);const all=[{...master,user_id:null},...connected];const busy:any[]=[];for(const c of all){const fb=await freeBusy(c,start,end);for(const b of fb.calendars?.[c.calendar_id]?.busy||[])busy.push({...b,user_id:c.user_id,calendar_email:c.calendar_email,user_name:c.user_id?null:"Company Calendar"})}const userBusyIds=[...new Set(busy.map((b:any)=>b.user_id).filter(Boolean))];if(userBusyIds.length){const {data:profiles}=await admin.from("profiles").select("id,full_name,email").in("id",userBusyIds);const nameMap=new Map((profiles||[]).map((p:any)=>[p.id,p.full_name||p.email||"Team Member"]));for(const b of busy)if(b.user_id)b.user_name=nameMap.get(b.user_id)||"Team Member"}return json({configured:true,available:busy.length===0,calendars:all.map(c=>({user_id:c.user_id,calendar_id:c.calendar_id,calendar_email:c.calendar_email,user_name:c.user_id?busy.find((b:any)=>b.user_id===c.user_id)?.user_name:null})),unconnected_user_ids:calendars.filter((x:any)=>x.connected===false).map((x:any)=>x.user_id),busy})}
  if(action==="create_event"){
   const scheduleId=String(payload.schedule_id||"");if(!scheduleId)return json({error:"schedule_id is required"},400);
   const {data:s,error:se}=await admin.from("schedules").select("*").eq("id",scheduleId).single();if(se||!s)return json({error:"Schedule not found"},404);
   if(s.google_calendar_status==="synced"&&s.google_calendar_event_id)return json({success:true,already_synced:true,event_id:s.google_calendar_event_id,event_url:s.google_calendar_url,meeting_link:s.meeting_link});
   const ids=await requiredUsers(admin,scheduleId),participants=await connectedUserCalendars(admin,ids),master=await masterInfo(admin);
   const start=String(s.start_at),end=String(s.end_at||"");if(!end)return json({error:"Schedule end time is required"},400);
   const conflicts:any[]=[];for(const c of [{...master,user_id:null},...participants.filter((x:any)=>x.connected!==false)]){const fb=await freeBusy(c,start,end);for(const b of fb.calendars?.[c.calendar_id]?.busy||[])if(overlaps(b,start,end))conflicts.push({...b,user_id:c.user_id,calendar_email:c.calendar_email})}
   if(conflicts.length){await admin.from("schedules").update({google_calendar_status:"failed"}).eq("id",scheduleId);return json({error:"Selected time is no longer available",code:"SLOT_CONFLICT",blocking:conflicts},409)}
   const attendees=participants.filter(c=>c.connected!==false&&c.calendar_email&&c.calendar_email!==master.calendar_email).map(c=>({email:c.calendar_email}));
   const body:any={id:("sankalp"+scheduleId.replaceAll("-","")).slice(0,1024),summary:s.title,description:[s.description||"",s.lead_id?"Sankalp Lead: "+s.lead_id:""].filter(Boolean).join("\n"),location:s.location_address||"",start:{dateTime:start,timeZone:s.timezone||"Asia/Kolkata"},end:{dateTime:end,timeZone:s.timezone||"Asia/Kolkata"},attendees,reminders:{useDefault:true},extendedProperties:{private:{sankalp_schedule_id:scheduleId,sankalp_lead_id:s.lead_id||""}}};
   if(s.mode==="digital")body.conferenceData={createRequest:{requestId:"meet-"+scheduleId,conferenceSolutionKey:{type:"hangoutsMeet"}}};
   const event=await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events?conferenceDataVersion="+(s.mode==="digital"?1:0)+"&sendUpdates=all",master.token,{method:"POST",body:JSON.stringify(body)});
   const meet=event.conferenceData?.entryPoints?.find((e:any)=>e.entryPointType==="video")?.uri||null;
   await admin.from("schedules").update({google_calendar_event_id:event.id,google_calendar_status:"synced",google_calendar_url:event.htmlLink||null,meeting_link:s.mode==="digital"?(meet||s.meeting_link):s.meeting_link}).eq("id",scheduleId);
   for(const p of participants){await upsertSync(admin,scheduleId,p.user_id,p.connected===false?"pending":"synced",p.connected===false?(p.error||"Google Calendar not connected"):null,event.id);}
   return json({success:true,event_id:event.id,event_url:event.htmlLink||null,meeting_link:meet});
  }
  if(action==="update_event"){const scheduleId=String(payload.schedule_id||"");const {data:s,error}=await admin.from("schedules").select("*").eq("id",scheduleId).single();if(error||!s?.google_calendar_event_id)return json({error:"Synced calendar event not found"},404);const master=await masterInfo(admin);const ids=await requiredUsers(admin,scheduleId),participants=await connectedUserCalendars(admin,ids);const {data:profiles}=await admin.from("profiles").select("id,email").in("id",ids);const profileEmails=new Set((profiles||[]).map((p:any)=>String(p.email||"").toLowerCase()).filter(Boolean));const connectedEmails=new Set(participants.filter((p:any)=>p.connected!==false&&p.calendar_email&&p.calendar_email!==master.calendar_email).map((p:any)=>String(p.calendar_email).toLowerCase()));const current=await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(s.google_calendar_event_id),master.token);const mergedEmails=[...(current.attendees||[]).map((a:any)=>String(a.email||"").toLowerCase()).filter((email:string)=>!profileEmails.has(email)||connectedEmails.has(email)),...participants.filter((p:any)=>p.connected!==false&&p.calendar_email&&p.calendar_email!==master.calendar_email).map((p:any)=>p.calendar_email)];const attendees=[...new Set(mergedEmails)].filter(Boolean).map((email:string)=>({email}));const event:any={summary:s.title,description:s.description||"",location:s.location_address||"",start:{dateTime:s.start_at,timeZone:s.timezone||"Asia/Kolkata"},end:{dateTime:s.end_at,timeZone:s.timezone||"Asia/Kolkata"},attendees};if(s.status==="customer_cancelled"||s.status==="cancelled")event.status="cancelled";const updated=await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(s.google_calendar_event_id)+"?sendUpdates=all",master.token,{method:"PATCH",body:JSON.stringify(event)});await admin.from("schedules").update({google_calendar_url:updated.htmlLink||s.google_calendar_url,google_calendar_status:"synced"}).eq("id",scheduleId);for(const p of participants){await upsertSync(admin,scheduleId,p.user_id,p.connected===false?"pending":"synced",p.connected===false?(p.error||"Google Calendar not connected"):null,s.google_calendar_event_id)}return json({success:true,event_url:updated.htmlLink||null})}
  if(action==="delete_event"){const scheduleId=String(payload.schedule_id||"");const {data:s,error}=await admin.from("schedules").select("google_calendar_event_id").eq("id",scheduleId).single();if(error||!s?.google_calendar_event_id)return json({success:true});const master=await masterInfo(admin);await gfetch("/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(s.google_calendar_event_id)+"?sendUpdates=all",master.token,{method:"DELETE"});await admin.from("schedules").update({google_calendar_status:"cancelled"}).eq("id",scheduleId);return json({success:true})}
  return json({error:"Unsupported action"},400);
 }catch(e){console.error("google-calendar error",e);return json({error:e instanceof Error?e.message:"Google Calendar operation failed"},500)}
});
