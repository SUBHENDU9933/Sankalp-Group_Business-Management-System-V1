import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body:any, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: {...corsHeaders, "Content-Type":"application/json"},
});
const adminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{autoRefreshToken:false,persistSession:false}}
);
const fromB64 = (s:string) => {
  const x=s.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-s.length%4)%4);
  return Uint8Array.from(atob(x), c=>c.charCodeAt(0));
};
const toB64 = (b:Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
const key = async() => {
  const secret=Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");
  if(!secret) throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");
  const normalized=secret.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-secret.length%4)%4);
  let bytes:Uint8Array;
  try { bytes=Uint8Array.from(atob(normalized), c=>c.charCodeAt(0)); }
  catch { bytes=new TextEncoder().encode(secret); }
  if(bytes.length!==32) throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
};
const decrypt = async(v:string) => {
  const [i,d]=v.split(".");
  const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(i)},await key(),fromB64(d));
  return new TextDecoder().decode(p);
};
async function gfetch(path:string, token:string, init:RequestInit={}) {
  const r=await fetch("https://www.googleapis.com/calendar/v3"+path,{
    ...init,
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(init.headers||{})}
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok) {
    const e:any=new Error(d?.error?.message||"Google Calendar request failed");
    e.status=r.status;
    throw e;
  }
  return d;
}
async function masterInfo(admin:any) {
  const {data:m,error}=await admin.from("google_calendar_master_connections").select("*").eq("status","connected").maybeSingle();
  if(error) throw error;
  if(!m) throw new Error("Company Master Calendar is not connected");
  if(m.access_token_encrypted&&m.token_expires_at&&new Date(m.token_expires_at).getTime()>Date.now()+120000) {
    return {...m,token:await decrypt(m.access_token_encrypted)};
  }
  if(!m.refresh_token_encrypted) throw new Error("Company Master Calendar needs to be reconnected");
  const refresh=await decrypt(m.refresh_token_encrypted);
  const clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if(!clientId||!clientSecret) throw new Error("Google OAuth client is not configured");
  const rr=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})
  });
  const d=await rr.json();
  if(!rr.ok) {
    await admin.from("google_calendar_master_connections").update({status:"error",last_error:d?.error_description||d?.error||"Token refresh failed"}).eq("id",m.id);
    throw new Error(d?.error_description||d?.error||"Company Master Calendar token refresh failed");
  }
  await admin.from("google_calendar_master_connections").update({
    access_token_encrypted:await (async()=>{
      const iv=new Uint8Array(12); crypto.getRandomValues(iv);
      const enc=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(d.access_token)));
      return toB64(iv)+"."+toB64(enc);
    })(),
    token_expires_at:new Date(Date.now()+Number(d.expires_in||3600)*1000).toISOString(),
    status:"connected",last_error:null,last_synced_at:new Date().toISOString()
  }).eq("id",m.id);
  return {...m,token:d.access_token};
}
async function failItem(admin:any,item:any,message:string) {
  const retry=Math.min(Number(item.retry_count||0)+1,10);
  const delayMinutes=Math.min(360,Math.pow(2,retry)*5);
  await admin.from("schedule_calendar_sync_items").update({
    sync_status:"failed",
    retry_count:retry,
    next_retry_at:new Date(Date.now()+delayMinutes*60000).toISOString(),
    last_attempt_at:new Date().toISOString(),
    last_error:message,
    last_source:"background_reconcile",
    updated_at:new Date().toISOString()
  }).eq("id",item.id);
}
async function syncItem(admin:any, master:any, item:any) {
  if(!item.google_event_id) {
    await failItem(admin,item,"Missing Google event id");
    return "failed";
  }
  const {data:profile}=await admin.from("profiles").select("email").eq("id",item.user_id).maybeSingle();
  const email=String(profile?.email||"").trim().toLowerCase();
  if(!email) {
    await failItem(admin,item,"Employee email is missing");
    return "failed";
  }
  const event=await gfetch(
    "/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(item.google_event_id),
    master.token
  );
  const existing=[...(event.attendees||[])].map((a:any)=>String(a.email||"").trim().toLowerCase()).filter(Boolean);
  if(!existing.includes(email)) {
    await gfetch(
      "/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(item.google_event_id)+"?sendUpdates=all",
      master.token,
      {method:"PATCH",body:JSON.stringify({attendees:[...(event.attendees||[]),{email:profile.email}]})}
    );
  }
  await admin.from("schedule_calendar_sync_items").update({
    sync_status:"synced",
    retry_count:0,
    next_retry_at:null,
    last_synced_at:new Date().toISOString(),
    last_attempt_at:new Date().toISOString(),
    last_error:null,
    last_source:"background_reconcile",
    updated_at:new Date().toISOString()
  }).eq("id",item.id);
  return "synced";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  try {
    const admin=adminClient();
    const token=req.headers.get("x-internal-cron-token")||"";
    const {data:valid,error:ve}=await admin.rpc("verify_calendar_reconcile_token",{candidate:token});
    if(ve||valid!==true) return json({error:"Unauthorized"},401);

    const {data:schedules,error:scheduleError}=await admin.from("schedules").select("*").eq("google_calendar_status","pending").order("updated_at",{ascending:true}).limit(100);
    if(scheduleError) throw scheduleError;
    const {data:items,error}=await admin.from("schedule_calendar_sync_items").select("id,schedule_id,user_id,google_event_id,sync_status,retry_count,next_retry_at").in("sync_status",["pending","failed"]).or("next_retry_at.is.null,next_retry_at.lte."+new Date().toISOString()).order("updated_at",{ascending:true}).limit(100);
    if(error) throw error;
    const userIds=[...new Set((items||[]).map((x:any)=>x.user_id).filter(Boolean))];
    const {data:connections}=userIds.length?await admin.from("google_calendar_connections").select("user_id,status,refresh_token_encrypted").in("user_id",userIds):{data:[]};
    const connected=new Set((connections||[]).filter((x:any)=>x.status==="connected"&&x.refresh_token_encrypted).map((x:any)=>x.user_id));
    const master=await masterInfo(admin);

    let synced=0,failed=0,skipped=0;
    const cancelledStatuses=new Set(["customer_cancelled","team_cancelled","customer_no_show","cancelled"]);
    for(const s of schedules||[]) {
      try {
        if(!s.google_calendar_event_id) { await admin.from("schedules").update({google_calendar_status:cancelledStatuses.has(String(s.status))||s.deleted_at?"cancelled":"failed"}).eq("id",s.id); continue; }
        const eventPath="/calendars/"+encodeURIComponent(master.calendar_id)+"/events/"+encodeURIComponent(s.google_calendar_event_id);
        if(s.deleted_at||cancelledStatuses.has(String(s.status))) {
          try { await gfetch(eventPath+"?sendUpdates=all",master.token,{method:"DELETE"}); } catch(e) { const status=Number((e as any)?.status||0); if(status!==404&&status!==410) throw e; }
          await admin.from("schedules").update({google_calendar_status:"cancelled"}).eq("id",s.id);
          await admin.from("schedule_calendar_sync_items").update({sync_status:"synced",last_synced_at:new Date().toISOString(),last_error:null,last_source:"background_reconcile",updated_at:new Date().toISOString()}).eq("schedule_id",s.id);
          synced++; continue;
        }
        const event=await gfetch(eventPath,master.token);
        const {data:participants}=await admin.from("schedule_participants").select("user_id,is_required").eq("schedule_id",s.id).eq("is_required",true);
        const userIds=[...new Set([s.owner_id,s.arranged_by,...(participants||[]).map((p:any)=>p.user_id)].filter(Boolean))];
        const {data:profiles}=userIds.length?await admin.from("profiles").select("id,email").in("id",userIds):{data:[]};
        const emails=(profiles||[]).map((p:any)=>String(p.email||"").trim()).filter(Boolean);
        const eventBody:any={summary:s.title,description:s.description||"",location:s.location_address||"",start:{dateTime:s.start_at,timeZone:s.timezone||"Asia/Kolkata"},end:{dateTime:s.end_at,timeZone:s.timezone||"Asia/Kolkata"},attendees:emails.map((email:string)=>({email})),extendedProperties:{private:{sankalp_schedule_id:s.id,sankalp_lead_id:s.lead_id||""}}};
        const updated=await gfetch(eventPath+"?sendUpdates=all",master.token,{method:"PATCH",body:JSON.stringify(eventBody)});
        await admin.from("schedules").update({google_calendar_status:"synced",google_calendar_url:updated.htmlLink||s.google_calendar_url}).eq("id",s.id);
        synced++;
      } catch(e) { await admin.from("schedules").update({google_calendar_status:"failed"}).eq("id",s.id); failed++; }
    }
    for(const item of items||[]) {
      if(!connected.has(item.user_id)) { skipped++; continue; }
      try { const result=await syncItem(admin,master,item); if(result==="synced") synced++; else failed++; }
      catch(e) { const message=e instanceof Error?e.message:"Calendar reconciliation failed"; await failItem(admin,item,message); failed++; }
    }
    return json({success:true,processed:(schedules||[]).length+(items||[]).length,synced,failed,skipped,ran_at:new Date().toISOString()});
  } catch(e) {
        const message=e instanceof Error?e.message:"Calendar reconciliation failed";
        await failItem(admin,item,message);
        failed++;
      }
    }
    return json({success:true,processed:(items||[]).length,synced,failed,skipped,ran_at:new Date().toISOString()});
  } catch(e) {
    console.error("google-calendar-reconcile error",e);
    return json({error:e instanceof Error?e.message:"Background reconciliation failed"},500);
  }
});
