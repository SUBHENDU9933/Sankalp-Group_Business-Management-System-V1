import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const scopes = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
];
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const supabaseAdmin=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
const randomText=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b64(b)};
const sha256=async(s:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
const encKey=async()=>{const raw=Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");if(!raw)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");return crypto.subtle.importKey("raw",new TextEncoder().encode(raw),{name:"AES-GCM"},false,["encrypt","decrypt"])};
const encrypt=async(value:string)=>{const iv=new Uint8Array(12);crypto.getRandomValues(iv);const key=await encKey();const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value)));return `${b64(iv)}.${b64(data)}`};
const decrypt=async(value:string)=>{const [ivText,dataText]=value.split(".");const from=(s:string)=>Uint8Array.from(atob(s.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));const key=await encKey();const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:from(ivText)},key,from(dataText));return new TextDecoder().decode(plain)};
const redirectUri=()=>Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI")||`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth/callback`;

async function googleToken(body:Record<string,string>){
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)});
  const d=await r.json();if(!r.ok)throw new Error(d?.error_description||d?.error||"Google token exchange failed");return d;
}
async function gfetch(path:string,token:string,init:RequestInit={}){const r=await fetch(`https://www.googleapis.com/calendar/v3${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||"Google Calendar request failed");return d;}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const url=new URL(req.url);
  try{
    const admin=supabaseAdmin();
    if(req.method==="GET" && url.pathname.endsWith("/callback")){
      const state=url.searchParams.get("state"),code=url.searchParams.get("code"),error=url.searchParams.get("error");
      const {data:st,error:se}=await admin.from("google_calendar_oauth_states").select("*").eq("state",state||"").maybeSingle();
      if(se||!st||new Date(st.expires_at)<new Date())return new Response("OAuth session expired. Please return to BMS and connect again.",{status:400});
      await admin.from("google_calendar_oauth_states").delete().eq("state",st.state);
      if(error)return Response.redirect(`${Deno.env.get("APP_PUBLIC_URL")||"https://sankalp-group-business-management-system-v1.vercel.app"}/profile?google_calendar=error&reason=${encodeURIComponent(error)}`);
      if(!code)return new Response("Google authorization code is missing.",{status:400});
      const clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");if(!clientId||!clientSecret)throw new Error("Google OAuth client is not configured");
      const tokens=await googleToken({code,client_id:clientId,client_secret:clientSecret,redirect_uri:st.redirect_uri,grant_type:"authorization_code",code_verifier:st.code_verifier});
      if(!tokens.access_token)throw new Error("Google did not return an access token");
      const profile=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`}}).then(r=>r.json());
      const refresh=tokens.refresh_token||null;
      const existing=await admin.from("google_calendar_connections").select("refresh_token_encrypted").eq("user_id",st.user_id).maybeSingle();
      const refreshEncrypted=refresh?await encrypt(refresh):(existing.data?.refresh_token_encrypted||null);
      if(!refreshEncrypted)throw new Error("Google did not return a refresh token. Reconnect with consent.");
      const expiresAt=new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString();
      await admin.from("google_calendar_connections").upsert({user_id:st.user_id,google_user_id:profile.sub||null,google_email:profile.email,primary_calendar_id:"primary",access_token_encrypted:await encrypt(tokens.access_token),refresh_token_encrypted:refreshEncrypted,token_expires_at:expiresAt,scope:tokens.scope||scopes.join(" "),status:"connected",last_error:null,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id"});
      const {data:me}=await admin.from("profiles").select("is_admin").eq("id",st.user_id).single();
      if(me?.is_admin){
        const calendars=await gfetch("/users/me/calendarList?maxResults=250",tokens.access_token);
        let master=(calendars.items||[]).find((c:any)=>c.summary==="SANKALP BMS – MASTER MEETINGS");
        if(!master)master=await gfetch("/calendars",tokens.access_token,{method:"POST",body:JSON.stringify({summary:"SANKALP BMS – MASTER MEETINGS",description:"Central meeting calendar for Sankalp BMS",timeZone:"Asia/Kolkata"})});
        await admin.from("schedule_calendar_mappings").delete().is("user_id",null).eq("provider","google");
        await admin.from("schedule_calendar_mappings").insert({user_id:null,calendar_email:master.id,calendar_id:master.id,provider:"google",enabled:true,is_primary:true});
      }
      return Response.redirect(`${Deno.env.get("APP_PUBLIC_URL")||"https://sankalp-group-business-management-system-v1.vercel.app"}/profile?google_calendar=connected`);
    }
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!bearer)return json({error:"Authentication required"},401);
    const {data:u,error:ue}=await admin.auth.getUser(bearer);if(ue||!u.user)return json({error:"Invalid or expired session"},401);
    const payload=await req.json().catch(()=>({})),action=String(payload.action||"start");
    if(action==="start"){
      const clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");if(!clientId)throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured");
      const redirect=redirectUri(),state=randomText(32),verifier=randomText(48),challenge=await sha256(verifier);
      await admin.from("google_calendar_oauth_states").insert({state,user_id:u.user.id,code_verifier:verifier,redirect_uri:redirect,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
      const q=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:"code",scope:scopes.join(" "),access_type:"offline",prompt:"consent",include_granted_scopes:"true",state,code_challenge:challenge,code_challenge_method:"S256"});
      return json({authorization_url:`https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`});
    }
    if(action==="status"){
      const {data:c}=await admin.from("google_calendar_connections").select("google_email,primary_calendar_id,status,scope,connected_at,last_synced_at,last_error").eq("user_id",u.user.id).maybeSingle();
      const {data:master}=await admin.from("schedule_calendar_mappings").select("calendar_id,calendar_email").is("user_id",null).eq("provider","google").eq("enabled",true).maybeSingle();
      return json({connected:Boolean(c?.status==="connected"),connection:c||null,master_calendar:master||null});
    }
    if(action==="disconnect"){
      await admin.from("google_calendar_connections").delete().eq("user_id",u.user.id);
      return json({success:true});
    }
    return json({error:"Unsupported action"},400);
  }catch(e){console.error("google-calendar-oauth error",e);return json({error:e instanceof Error?e.message:"Google OAuth failed"},500);}
});
