import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/services/attachmentService";

export const fetchSchedules = async ({ from, to, status, ownerId } = {}) => {
  let q = supabase.from("schedules").select("*, arranger:profiles!schedules_arranged_by_fkey(id,full_name,email), owner:profiles!schedules_owner_id_fkey(id,full_name,email), creator:profiles!schedules_created_by_fkey(id,full_name), next_owner:profiles!schedules_next_action_owner_id_fkey(id,full_name), participants:schedule_participants(user_id,participant_role,is_required,profile:profiles!schedule_participants_user_id_fkey(id,full_name,email,role,is_admin))").is("deleted_at", null).order("start_at", { ascending: true });
  if (from) q=q.gte("start_at",from); if(to) q=q.lt("start_at",to); if(status) q=q.eq("status",status); if(ownerId) q=q.eq("owner_id",ownerId);
  const {data,error}=await q; if(error) throw error; return data||[];
};
export const fetchScheduleById=async(id)=>{const {data,error}=await supabase.from("schedules").select("*, arranger:profiles!schedules_arranged_by_fkey(id,full_name,email), owner:profiles!schedules_owner_id_fkey(id,full_name,email), creator:profiles!schedules_created_by_fkey(id,full_name), next_owner:profiles!schedules_next_action_owner_id_fkey(id,full_name)").eq("id",id).single();if(error)throw error;return data;};
export const fetchMeetingRule=async(meetingType,mode)=>{const {data,error}=await supabase.from("schedule_meeting_rules").select("*").eq("meeting_type",meetingType).eq("mode",mode).maybeSingle();if(error)throw error;return data||{participant_rule:{owner:true,manager:"none",director:false},default_duration_minutes:30,travel_buffer_minutes:0};};
export const fetchCalendarStatus=async()=>{const {data,error}=await supabase.functions.invoke("google-calendar",{body:{action:"status"}});if(error)throw error;return data;};
export const fetchGoogleCalendarConnection=async()=>{const {data,error}=await supabase.functions.invoke("google-calendar-oauth",{body:{action:"status"}});if(error)throw error;return data;};
export const startGoogleCalendarOAuth=async(connectionType="personal")=>{const {data,error}=await supabase.functions.invoke("google-calendar-oauth",{body:{action:"start",connection_type:connectionType}});if(error)throw error;if(!data?.authorization_url)throw new Error("Google authorization URL was not returned");window.location.assign(data.authorization_url);};
export const disconnectGoogleCalendar=async(connectionType="personal")=>{const {data,error}=await supabase.functions.invoke("google-calendar-oauth",{body:{action:"disconnect",connection_type:connectionType}});if(error)throw error;return data;};
export const checkCalendarAvailability=async({start,end,userIds})=>{const {data,error}=await supabase.functions.invoke("google-calendar",{body:{action:"availability",start,end,user_ids:userIds}});if(error)throw error;return data;};
export const syncPendingCalendar=async()=>{const {data,error}=await supabase.functions.invoke("google-calendar",{body:{action:"sync_pending"}});if(error)throw error;return data;};
export const syncScheduleToCalendar=async(scheduleId)=>{const {data,error}=await supabase.functions.invoke("google-calendar",{body:{action:"create_event",schedule_id:scheduleId}});if(error){const details=await error.context?.json?.().catch?.(()=>null);const e=new Error(details?.error||error.message||"Calendar sync failed");e.code=details?.code;e.details=details;throw e;}return data;};
export const fetchCalendarMappings=async()=>{const {data,error}=await supabase.from("schedule_calendar_mappings").select("*, profile:profiles!schedule_calendar_mappings_user_id_fkey(id,full_name,email,role,is_admin)").order("user_id");if(error)throw error;return data||[];};
export const upsertCalendarMapping=async(payload)=>{const {data,error}=await supabase.from("schedule_calendar_mappings").upsert(payload,{onConflict:"provider,calendar_id,user_id"}).select("*").single();if(error)throw error;return data;};
export const createSchedule=async(payload,participantIds=[],requiredParticipantIds=[])=>{
  const ids=[...new Set((participantIds||[]).filter(Boolean))];
  const requiredIds=[...new Set((requiredParticipantIds||[]).filter(Boolean))];
  const {data:id,error}=await supabase.rpc("create_schedule_with_participants",{
    p_payload:{...payload,owner_id:null},
    p_participant_ids:ids,
    p_required_participant_ids:requiredIds
  });
  if(error)throw error;
  if(!id)throw new Error("Schedule ID was not returned");

  const meetingStages = ["site_visit","customer_home","office_meeting","measurement_visit","project_review","material_discussion","video_meeting","design_presentation"];
  if (payload.lead_id && meetingStages.includes(payload.meeting_type)) {
    const { data:lead } = await supabase.from("leads").select("id,status").eq("id",payload.lead_id).maybeSingle();
    if (lead && ["contacted","site_visit"].includes(lead.status)) {
      await supabase.from("leads").update({status:"floor_plan_site_info"}).eq("id",lead.id);
    }
  }
  return fetchScheduleById(id);
};
export const updateSchedule=async(id,payload)=>{
  const {data:authData}=await supabase.auth.getUser();
  const safePayload={...payload};
  if(authData?.user?.id) safePayload.updated_by=authData.user.id;
  const {data,error}=await supabase.from("schedules").update(safePayload).eq("id",id).select("*").single();
  if(error)throw error;
  return data;
};
export const completeSchedule=async(id,payload={})=>{
  const schedule=await fetchScheduleById(id);
  const result=await updateSchedule(id,{...payload,status:"completed",completed_at:new Date().toISOString()});
  const meetingStages=["site_visit","customer_home","office_meeting","measurement_visit","project_review","material_discussion","video_meeting","design_presentation"];
  if(schedule.lead_id && meetingStages.includes(schedule.meeting_type)){
    const {data:lead}=await supabase.from("leads").select("id,status").eq("id",schedule.lead_id).maybeSingle();
    if(lead && ["floor_plan_site_info","site_visit"].includes(lead.status)){
      await supabase.from("leads").update({status:"estimate_to_be_created"}).eq("id",lead.id);
    }
  }
  return result;
};
export const fetchScheduleFiles=async(scheduleId)=>{const {data,error}=await supabase.from("schedule_files").select("*").eq("schedule_id",scheduleId).is("deleted_at",null).order("uploaded_at",{ascending:false});if(error)throw error;return data||[];};
export const uploadScheduleFile=async(scheduleId,leadId,file,{source="employee",category="other"}={})=>{const res=await uploadFile(file,`schedule-files/${scheduleId}`);const {data:a}=await supabase.auth.getUser();const {data,error}=await supabase.from("schedule_files").insert([{schedule_id:scheduleId,lead_id:leadId||null,file_name:res.name,file_type:res.type,file_size:res.size,source,category,storage_provider:"supabase",storage_path:res.path,file_url:res.url,uploaded_by:a?.user?.id}]).select("*").single();if(error)throw error;return data;};
export const fetchScheduleStats=async()=>{const {data,error}=await supabase.from("schedules").select("id,status,start_at,next_action_date").is("deleted_at",null);if(error)throw error;return data||[];};
