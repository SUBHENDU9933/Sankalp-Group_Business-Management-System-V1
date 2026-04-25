import { supabase } from "@/lib/supabase";

export const fetchProfiles = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const updateProfileRole = async (id, role) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (id, payload) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
