import { supabase } from "@/lib/supabase";

export const fetchVendors = async () => {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createVendor = async (payload, userId) => {
  const { data, error } = await supabase
    .from("vendors")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateVendor = async (id, payload) => {
  const { data, error } = await supabase
    .from("vendors")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const fetchVendorPayments = async (vendorId) => {
  let q = supabase
    .from("vendor_payments")
    .select("*, vendor:vendors(id,name,type), project:projects(id,project_name)")
    .order("payment_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createVendorPayment = async (payload, userId) => {
  const { data, error } = await supabase
    .from("vendor_payments")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
