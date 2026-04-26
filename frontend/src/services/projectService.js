import { supabase } from "@/lib/supabase";

export const fetchProjects = async () => {
  // Try with members join first (post v8). Fall back to plain query if table doesn't exist yet.
  const withMembers = await supabase
    .from("projects")
    .select("*, customer:customers(id,name,phone), members:project_members(user_id,role,profile:profiles!project_members_user_id_fkey(id,full_name,email,designation))")
    .order("created_at", { ascending: false });
  if (!withMembers.error) return withMembers.data || [];
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(id,name,phone)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, members: [] }));
};

export const fetchProjectById = async (id) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(id,name,phone,address), creator:profiles!projects_created_by_fkey(id,full_name,email)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createProject = async (payload, userId) => {
  const { data, error } = await supabase
    .from("projects")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateProject = async (id, payload) => {
  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteProject = async (id) => {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
};

// ---------- PROJECT MEMBERS (multi-user assignment, admin-only writes) ----------
export const fetchProjectMembers = async (projectId) => {
  const { data, error } = await supabase
    .from("project_members")
    .select("*, profile:profiles!project_members_user_id_fkey(id,full_name,email,designation,role)")
    .eq("project_id", projectId)
    .order("added_at", { ascending: true });
  if (error) {
    if ((error.message || "").includes("project_members")) return [];
    throw error;
  }
  return data || [];
};

export const addProjectMember = async ({ projectId, userId, role = "member", addedBy }) => {
  const { data, error } = await supabase
    .from("project_members")
    .insert([{ project_id: projectId, user_id: userId, role, added_by: addedBy }])
    .select("*, profile:profiles!project_members_user_id_fkey(id,full_name,email,designation,role)")
    .single();
  if (error) throw error;
  return data;
};

export const removeProjectMember = async (memberId) => {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
};

// ---------- EXPENSES ----------
export const fetchExpensesByProject = async (projectId) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, creator:profiles!expenses_created_by_fkey(id,full_name,email)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createExpense = async (payload, userId) => {
  const { data, error } = await supabase
    .from("expenses")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteExpense = async (id) => {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
};
