import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
const bytes=(s:string)=>Uint8Array.from(atob(s.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const key=async()=>{const raw=Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");if(!raw)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");let b:Uint8Array;try{b=bytes(raw)}catch{b=new TextEncoder().encode(raw)}if(b.length!==32)throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");return crypto.subtle.importKey("raw",b,{name:"AES-GCM"},false,["encrypt","decrypt"])};
const decrypt=async(v:string)=>{const p=v.split(".");const d=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(p[0])},await key(),bytes(p[1]));return new TextDecoder().decode(d)};
const admin=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
const userDb=(t:string)=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:"Bearer "+t}}});
async function drive(path:string,t:string,init:RequestInit={}){const r=await fetch("https://www.googleapis.com/drive/v3"+path,{...init,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||"Google Drive request failed");return d}
async function refresh(a:any,c:any){if(c.token_expires_at&&new Date(c.token_expires_at).getTime()>Date.now()+120000)return c;const r=await decrypt(c.refresh_token_encrypted);const x=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,client_secret:Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,refresh_token:r,grant_type:"refresh_token"})});const t=await x.json();if(!x.ok)throw new Error(t?.error_description||"Google token refresh failed");const iv=new Uint8Array(12);crypto.getRandomValues(iv);const d=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(t.access_token)));const enc=b64(iv)+"."+b64(d);const patch={access_token_encrypted:enc,token_expires_at:new Date(Date.now()+Number(t.expires_in||3600)*1000).toISOString(),status:"connected",last_error:null,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()};await a.from("google_drive_connections").update(patch).eq("id",c.id);return {...c,...patch}}
async function folder(t:string,name:string,parent:string){const q="name='"+name.replaceAll("'","\\'")+"' and mimeType='application/vnd.google-apps.folder' and trashed=false and '"+parent+"' in parents";const x=await drive("/files?q="+encodeURIComponent(q)+"&pageSize=10&fields=files(id,name)",t);if(x.files?.[0])return x.files[0].id;const f=await drive("/files?fields=id,name",t,{method:"POST",body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parent]})});return f.id}
const phoneSuffix=(phone:string)=>{const d=String(phone||"").replace(/\D/g,"");return d.slice(-5)||"unknown"};
const leadFolderName=(name:string,phone:string)=>String(name||"Lead").trim()+" - "+phoneSuffix(phone);
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  try{
    const a=admin();
    const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!bearer) return json({error:"Authentication required"},401);
    const {data:u,error:ue}=await a.auth.getUser(bearer);
    if(ue||!u.user) return json({error:"Invalid or expired session"},401);

    const isJson=req.headers.get("content-type")?.includes("application/json");
    const form:any=isJson?await req.json():await req.formData();
    const get=(k:string)=>isJson?form[k]:form.get(k);
    const action=String(get("action")||"start_upload");
    const moduleName=String(get("module")||"misc");
    const recordId=String(get("record_id")||"");
    const fileId=String(get("file_id")||"");
    const fileName=String(get("file_name")||"");
    const mimeType=String(get("mime_type")||"application/octet-stream");
    const size=Number(get("size")||0);
    const leadId=String(get("lead_id")||"")||null;
    const source=String(get("source")||"employee");
    const category=String(get("category")||"other");
    const sessionUrl=String(get("session_url")||"");
    const suppliedDriveFileId=String(get("drive_file_id")||"");
    const suppliedDriveName=String(get("drive_file_name")||"");
    const suppliedDriveMime=String(get("drive_mime_type")||"");
    const suppliedDriveSize=Number(get("drive_size")||0);
    const suppliedDriveUrl=String(get("drive_web_view_link")||"");
    const suppliedParentId=String(get("drive_parent_id")||"");

    let scheduleLeadId=leadId;
    if(moduleName==="schedule"){
      const {data:s}=await userDb(bearer).from("schedules").select("id,lead_id").eq("id",recordId).is("deleted_at",null).maybeSingle();
      if(!s?.id) return json({error:"Schedule not found or access denied"},403);
      scheduleLeadId=leadId||s.lead_id||null;
      if(!scheduleLeadId) return json({error:"This Schedule is not linked to a Lead. Link the Schedule to a Lead before uploading files."},400);
    }
    if(moduleName==="lead"){
      const {data:l}=await userDb(bearer).from("leads").select("id").eq("id",recordId).is("deleted_at",null).maybeSingle();
      if(!l?.id) return json({error:"Lead not found or access denied"},403);
    }

    const {data:c}=await a.from("google_drive_connections").select("*").maybeSingle();
    if(!c||c.status!=="connected") return json({error:"Google Drive is not connected. Ask Admin to connect it."},409);
    const conn=await refresh(a,c);
    if(!conn.root_folder_id) throw new Error("Google Drive root folder is not configured");
    const t=await decrypt(conn.access_token_encrypted!);
    const bmsRoot=await folder(t,"SANKALP BMS",conn.root_folder_id);

    const ensureLeadFolder=async(id:string)=>{
      const {data:l}=await a.from("leads").select("id,name,phone,drive_folder_id").eq("id",id).maybeSingle();
      if(!l) throw new Error("Lead not found");
      if(l.drive_folder_id) return l.drive_folder_id;
      const leadsRoot=await folder(t,"LEADS",bmsRoot);
      const id2=await folder(t,leadFolderName(l.name,l.phone),leadsRoot);
      await a.from("leads").update({drive_folder_id:id2}).eq("id",id);
      return id2;
    };

    if(action==="start_upload"){
      if(!fileName||size<1) return json({error:"File metadata is required"},400);
      const effectiveLeadId=scheduleLeadId||(moduleName==="lead"?recordId:null);
      if(!effectiveLeadId) return json({error:"Lead reference is required"},400);
      const leadDriveFolder=await ensureLeadFolder(effectiveLeadId);
      const meta={name:fileName,mimeType,parents:[leadDriveFolder]};
      const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,parents",{
        method:"POST",
        headers:{Authorization:"Bearer "+t,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(size)},
        body:JSON.stringify(meta)
      });
      if(!r.ok) throw new Error(await r.text());
      const session=r.headers.get("Location");
      if(!session) throw new Error("Google Drive did not return an upload session");
      return json({session_url:session,parent_folder_id:leadDriveFolder,provider:"google_drive"});
    }

    if(action==="finalize_upload"){
      const effectiveLeadId=scheduleLeadId||(moduleName==="lead"?recordId:null);
      if(!effectiveLeadId) return json({error:"Lead reference is required for file registry"},400);

      let d:any=null;
      if(suppliedDriveFileId){
        const meta=await drive("/files/"+encodeURIComponent(suppliedDriveFileId)+"?fields=id,name,mimeType,size,webViewLink,parents",t);
        d={
          id:meta.id,
          name:meta.name||suppliedDriveName||fileName,
          mimeType:meta.mimeType||suppliedDriveMime||mimeType,
          size:Number(meta.size||suppliedDriveSize||size),
          webViewLink:meta.webViewLink||suppliedDriveUrl||"",
          parents:meta.parents||((suppliedParentId?[suppliedParentId]:[]))
        };
      } else {
        if(!sessionUrl||size<1) return json({error:"Upload session is missing"},400);
        const r=await fetch(sessionUrl,{method:"PUT",headers:{"Content-Range":"*/"+size,"Content-Length":"0"}});
        const bodyText=await r.text().catch(()=> "");
        let parsed:any={};
        try{parsed=bodyText?JSON.parse(bodyText):{}}catch{parsed={}};
        if(r.status===308) return json({error:"Google Drive upload is not complete yet",upload_incomplete:true,range:r.headers.get("Range")||null},409);
        if(!r.ok) throw new Error(parsed?.error?.message||bodyText||("Google Drive finalize failed ("+r.status+")"));
        d=parsed;
        if(!d?.id) throw new Error("Google Drive completed the upload but returned no file metadata");
      }

      let scheduleFile:any=null;
      if(moduleName==="schedule"){
        const {data:inserted,error:ie}=await a.from("schedule_files").insert([{
          schedule_id:recordId,lead_id:effectiveLeadId,file_name:d.name||fileName,file_type:d.mimeType||mimeType,
          file_size:Number(d.size||size),source,category,storage_provider:"google_drive",storage_path:null,
          file_url:d.webViewLink||("https://drive.google.com/open?id="+d.id),drive_file_id:d.id,
          drive_url:d.webViewLink||("https://drive.google.com/open?id="+d.id),
          drive_parent_id:(d.parents||[])[0]||null,uploaded_by:u.user.id
        }]).select("*").single();
        if(ie){
          try{await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(d.id),{method:"DELETE",headers:{Authorization:"Bearer "+t}})}catch(_){}
          throw new Error("Drive upload succeeded, but BMS Schedule metadata save failed: "+ie.message);
        }
        scheduleFile=inserted;
      }

      const {data:lf,error:lfe}=await a.from("lead_files").insert([{
        lead_id:effectiveLeadId,schedule_id:moduleName==="schedule"?recordId:null,file_name:d.name||fileName,
        file_type:d.mimeType||mimeType,file_size:Number(d.size||size),
        source:moduleName==="schedule"?"schedule":source,category,storage_provider:"google_drive",
        drive_file_id:d.id,drive_url:d.webViewLink||("https://drive.google.com/open?id="+d.id),
        drive_parent_id:(d.parents||[])[0]||null,uploaded_by:u.user.id
      }]).select("*").single();

      if(lfe){
        if(scheduleFile?.id) await a.from("schedule_files").delete().eq("id",scheduleFile.id);
        try{await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(d.id),{method:"DELETE",headers:{Authorization:"Bearer "+t}})}catch(_){}
        throw new Error("Drive upload succeeded, but Lead Files metadata save failed: "+lfe.message);
      }

      return json({
        provider:"google_drive",drive_file_id:d.id,drive_url:d.webViewLink||("https://drive.google.com/open?id="+d.id),
        drive_parent_id:(d.parents||[])[0]||null,name:d.name||fileName,type:d.mimeType||mimeType,
        size:Number(d.size||size),schedule_file:scheduleFile,lead_file:lf
      });
    }

    if(action==="download"||action==="preview"){
      if(!fileId) return json({error:"File reference is missing"},400);
      let sf:any=null;
      const {data:lf}=await userDb(bearer).from("lead_files").select("id,file_name,file_type,drive_file_id").eq("id",fileId).is("deleted_at",null).maybeSingle();
      if(lf?.drive_file_id) sf=lf;
      else {
        const {data:s}=await userDb(bearer).from("schedule_files").select("id,file_name,file_type,drive_file_id").eq("id",fileId).is("deleted_at",null).maybeSingle();
        sf=s;
      }
      if(!sf?.drive_file_id) return json({error:"File not found or access denied"},404);
      const r=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(sf.drive_file_id)+"?alt=media",{headers:{Authorization:"Bearer "+t}});
      if(!r.ok) throw new Error(await r.text());
      const safeName=String(sf.file_name||"download").replaceAll('"',"");
      return new Response(r.body,{status:200,headers:{
        "Content-Type":sf.file_type||r.headers.get("content-type")||"application/octet-stream",
        "Content-Disposition":(action==="preview"?"inline":"attachment")+'; filename="'+safeName+'"',
        ...CORS
      }});
    }

    if(action==="move_lead_to_customer"){
      const lid=String(get("lead_id")||"");const cid=String(get("customer_id")||"");
      if(!lid||!cid)return json({error:"Lead and customer references are required"},400);
      const {data:l}=await a.from("leads").select("id,name,phone,drive_folder_id,status").eq("id",lid).single();
      const {data:customer}=await a.from("customers").select("id,name,phone,drive_folder_id,linked_lead_id").eq("id",cid).single();
      if(!l||!customer)return json({error:"Lead or customer not found"},404);
      if(l.status!=="converted")return json({error:"Lead must be converted before its Drive folder is moved"},409);
      if(customer.linked_lead_id!==lid)return json({error:"Customer is not linked to this Lead"},403);
      const leadsRoot=await folder(t,"LEADS",bmsRoot);const customersRoot=await folder(t,"CUSTOMERS",bmsRoot);
      let fid=l.drive_folder_id;if(!fid)fid=await folder(t,leadFolderName(l.name,l.phone),leadsRoot);
      const meta=await drive("/files/"+encodeURIComponent(fid)+"?fields=id,name,parents,trashed",t);
      const parents=(meta.parents||[]).join(",");
      if(!parents.split(",").includes(customersRoot)){
        await drive("/files/"+encodeURIComponent(fid)+"?addParents="+encodeURIComponent(customersRoot)+"&removeParents="+encodeURIComponent(parents),t,{method:"PATCH",body:JSON.stringify({})});
      }
      await a.from("leads").update({drive_folder_id:fid}).eq("id",lid);
      await a.from("customers").update({drive_folder_id:fid}).eq("id",cid);
      return json({success:true,drive_folder_id:fid});
    }

    if(action==="delete_lead_folder"){
      const lid=String(get("lead_id")||"");if(!lid)return json({error:"Lead reference is required"},400);
      const {data:l}=await a.from("leads").select("id,status,drive_folder_id").eq("id",lid).single();
      if(!l)return json({error:"Lead not found"},404);
      if(l.status==="converted")return json({error:"Converted Leads cannot have their Drive folder deleted"},409);
      if(l.drive_folder_id){
        const r=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(l.drive_folder_id),{method:"DELETE",headers:{Authorization:"Bearer "+t}});
        if(!r.ok&&r.status!==404)throw new Error(await r.text());
      }
      await a.from("leads").update({drive_folder_id:null}).eq("id",lid);
      return json({success:true});
    }

    if(action==="delete"){
      const id=String(get("drive_file_id")||"");if(!id)return json({error:"drive_file_id is required"},400);
      const r=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+t}});
      if(!r.ok&&r.status!==404)throw new Error(await r.text());
      return json({success:true});
    }

    return json({error:"Unsupported action"},400);
  }catch(e){
    console.error("google-drive-storage error",e);
    return json({error:e instanceof Error?e.message:"Google Drive storage failed"},500);
  }
});