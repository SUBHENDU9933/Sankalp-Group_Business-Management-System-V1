import { supabase } from "@/lib/supabase";

export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from("customers")
    .select("*, creator:profiles!customers_created_by_fkey(id,full_name,email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createCustomer = async (payload, userId) => {
  const { data, error } = await supabase
    .from("customers")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateCustomer = async (id, payload) => {
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const requestDeleteCustomer = async (id, _userId) => {
  const { error } = await supabase.rpc("request_delete_customer", { p_id: id });
  if (error) throw error;
};

export const cancelDeleteCustomer = async (id) => {
  const { error } = await supabase.rpc("cancel_delete_customer", { p_id: id });
  if (error) throw error;
};

export const adminDeleteCustomer = async (id) => {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
};

export const fetchCustomerById = async (id) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};
