import { supabase } from "@/lib/supabase";

export async function fetchRmReAssignments() {
  const { data, error } = await supabase
    .from("rm_re_assignments")
    .select("id,rm_id,re_id,assigned_by,created_at,is_active,rm:profiles!rm_id(id,full_name,email,role),re:profiles!re_id(id,full_name,email,role)")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function assignReToRm(rmId, reId) {
  const { data: userData } = await supabase.auth.getUser();
  const assignedBy = userData.user?.id;
  if (!assignedBy) throw new Error("You must be signed in");
  const { data, error } = await supabase
    .from("rm_re_assignments")
    .upsert({ rm_id: rmId, re_id: reId, assigned_by: assignedBy, is_active: true }, { onConflict: "rm_id,re_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeReFromRm(assignmentId) {
  const { error } = await supabase.from("rm_re_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
}
