import { supabase } from "@/lib/supabase";

export const fetchLeadActivities = async (leadId) => {
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*, creator:profiles!lead_activities_created_by_fkey(id,full_name,email)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const addLeadActivity = async ({ leadId, type, content, meta, userId }) => {
  const { data, error } = await supabase
    .from("lead_activities")
    .insert([{ lead_id: leadId, type, content: content || null, meta: meta || null, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};


export const logLeadCallOutcome = async ({ leadId, outcome, userId, note }) => {
  if (!leadId || !["connected","not_connected"].includes(outcome)) throw new Error("Invalid call outcome");
  const status = outcome === "connected" ? "contacted" : "not_contacted";
  const payload = { status };
  if (outcome === "connected") payload.last_contact_date = new Date().toISOString().slice(0, 10);
  const { error: statusError } = await supabase.from("leads").update(payload).eq("id", leadId);
  if (statusError) throw statusError;
  const content = note?.trim()
    ? "Call " + (outcome === "connected" ? "connected" : "not connected") + " — " + note.trim()
    : "Call " + (outcome === "connected" ? "connected" : "not connected");
  const { data, error } = await supabase.from("lead_activities")
    .insert([{ lead_id: leadId, type: "call", content, meta: { outcome, resulting_status: status }, created_by: userId }])
    .select("*").single();
  if (error) throw error;
  return data;
};
