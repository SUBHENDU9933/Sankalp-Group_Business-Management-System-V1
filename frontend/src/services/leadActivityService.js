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
