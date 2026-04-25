import { supabase } from "@/lib/supabase";

export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(id,name,phone)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchProjectById = async (id) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(id,name,phone,address)")
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

export const fetchExpensesByProject = async (projectId) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
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
