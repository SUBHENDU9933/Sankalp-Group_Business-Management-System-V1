import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const SCOPES=["openid","email","profile","https://www.googleapis.com/auth/drive.file"];
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const admin=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
const bytes=(s:string)=>Uint8Array.from(atob(s.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const randomText=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b64(b)};
const sha256=async(s:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
const key=async()=>{const raw=Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");if(!raw)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");let b:Uint8Array;try{b=bytes(raw)}catch{b=new TextEncoder().encode(raw)}if(b.length!==32)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");return crypto.subtle.importKey("raw",b,{name:"AES-GCM"},false,["encrypt","decrypt"])};
const encrypt=async(v:string)=>{const iv=new Uint8Array(12);crypto.getRandomValues(iv);const k=await key();const d=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(v)));return b64(iv)+"."+b64(d)};
const decrypt=async(v:string)=>{const p=v.split(".");const k=await key();const d=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(p[0])},k,bytes(p[1]));return new TextDecoder().decode(d)};
const redirect=()=>Deno.env.get("GOOGLE_DRIVE_OAUTH_REDIRECT_URI")||Deno.env.get("GOOGLE_DRIVE_OAUTH_REDIRECT_URI")||Deno.env.get("SUPABASE_URL")+"/functions/v1/google-drive-oauth/callback";
async function token(body:any){const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)});const d=await r.json();if(!r.ok)throw new Error(d?.error_description||d?.error||"Google token exchange failed");return d}
async function drive(path:string,t:string,init:RequestInit={}){const r=await fetch("https://www.googleapis.com/drive/v3"+path,{...init,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||"Google Drive request failed");return d}
async function createRoot(t:string){const q="name='SANKALP BMS' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents";const x=await drive("/files?q="+encodeURIComponent(q)+"&pageSize=10&fields=files(id,name)",t);if(x.files?.[0])return x.files[0].id;const f=await drive("/files?fields=id,name",t,{method:"POST",body:JSON.stringify({name:"SANKALP BMS",mimeType:"application/vnd.google-apps.folder"})});return f.id}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 const a=admin();
 try{
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname.endsWith("/callback")){
   const state=url.searchParams.get("state")||"",code=url.searchParams.get("code"),err=url.searchParams.get("error");
   const {data:st}=await a.from("google_calendar_oauth_states").select("*").eq("state",state).maybeSingle();
   if(!st||new Date(st.expires_at)<new Date())return new Response("OAuth session expired. Please return to BMS and connect again.",{status:400});
   await a.from("google_calendar_oauth_states").delete().eq("state",state);
   if(err)return Response.redirect((Deno.env.get("APP_PUBLIC_URL")||"https://app.sankalpinterior.com")+"/admin/calendar-settings?google_drive=error&reason="+encodeURIComponent(err));
   if(!code)throw new Error("Google authorization code is missing");
   const clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");if(!clientId||!clientSecret)throw new Error("Google OAuth client is not configured");
   const t=await token({code,client_id:clientId,client_secret:clientSecret,redirect_uri:st.redirect_uri,grant_type:"authorization_code",code_verifier:st.code_verifier});
   const p=await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+t.access_token}})).json();
   if(!t.refresh_token)throw new Error("Google did not return a refresh token. Reconnect with consent.");
   await a.from("google_drive_connections").delete().neq("id","00000000-0000-0000-0000-000000000000");
   const root=await createRoot(t.access_token);
   const {error:ce}=await a.from("google_drive_connections").insert({google_user_id:p.sub||null,google_email:p.email,root_folder_id:root,access_token_encrypted:await encrypt(t.access_token),refresh_token_encrypted:await encrypt(t.refresh_token),token_expires_at:new Date(Date.now()+Number(t.expires_in||3600)*1000).toISOString(),scope:t.scope||SCOPES.join(" "),status:"connected",last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(ce)throw ce;
   return Response.redirect((Deno.env.get("APP_PUBLIC_URL")||"https://app.sankalpinterior.com")+"/admin/calendar-settings?google_drive=connected");
  }
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!bearer)return json({error:"Authentication required"},401);
  const {data:u,error:ue}=await a.auth.getUser(bearer);if(ue||!u.user)return json({error:"Invalid or expired session"},401);
  const body=await req.json().catch(()=>({}));const action=String(body.action||"status");
  if(action==="start"){const {data:p}=await a.from("profiles").select("is_admin").eq("id",u.user.id).single();if(!p?.is_admin)return json({error:"Only Admin can connect Google Drive"},403);const clientId=Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");if(!clientId)throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured");const st=randomText(32),ver=randomText(48);await a.from("google_calendar_oauth_states").insert({state:st,user_id:u.user.id,connection_type:"drive",redirect_path:"/admin/calendar-settings",code_verifier:ver,redirect_uri:redirect(),expires_at:new Date(Date.now()+600000).toISOString()});const q=new URLSearchParams({client_id:clientId,redirect_uri:redirect(),response_type:"code",scope:SCOPES.join(" "),access_type:"offline",prompt:"consent",include_granted_scopes:"true",state:st,code_challenge:await sha256(ver),code_challenge_method:"S256"});return json({authorization_url:"https://accounts.google.com/o/oauth2/v2/auth?"+q.toString()})}
  if(action==="status"){const {data:c}=await a.from("google_drive_connections").select("google_email,root_folder_id,status,scope,connected_at,last_synced_at,last_error").maybeSingle();return json({connected:c?.status==="connected",connection:c||null})}
  if(action==="disconnect"){const {data:p}=await a.from("profiles").select("is_admin").eq("id",u.user.id).single();if(!p?.is_admin)return json({error:"Only Admin can disconnect Google Drive"},403);await a.from("google_drive_connections").delete().neq("id","00000000-0000-0000-0000-000000000000");return json({success:true})}
  return json({error:"Unsupported action"},400);
 }catch(e){console.error("google-drive-oauth error",e);return json({error:e instanceof Error?e.message:"Google Drive OAuth failed"},500)}
});