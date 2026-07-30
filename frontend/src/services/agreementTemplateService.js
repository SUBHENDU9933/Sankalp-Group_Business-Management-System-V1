import { supabase } from "@/lib/supabase";

export const fetchTemplates = async () => {
  const { data, error } = await supabase
    .from("agreement_templates")
    .select("*, creator:profiles!agreement_templates_created_by_fkey(id,full_name,email)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchTemplateById = async (id) => {
  const { data, error } = await supabase
    .from("agreement_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createTemplate = async (payload, userId) => {
  const { data, error } = await supabase
    .from("agreement_templates")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateTemplate = async (id, payload) => {
  const { data, error } = await supabase
    .from("agreement_templates")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const softDeleteTemplate = async (id, userId) => {
  const { error } = await supabase
    .from("agreement_templates")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

// A blank clause row for the template builder UI
export const emptyClause = () => ({
  id: `clause_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title: "New Clause",
  body: "",
  is_optional: false,
  enabled_default: true,
  sort_order: 999,
});
