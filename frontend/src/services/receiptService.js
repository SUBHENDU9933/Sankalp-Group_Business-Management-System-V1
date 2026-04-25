import { supabase } from "@/lib/supabase";

export const fetchReceipts = async () => {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, customer:customers(id,name,phone,address)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchReceiptsByCustomer = async (customerId) => {
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchReceiptById = async (id) => {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, customer:customers(id,name,phone,address,project_details)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createReceipt = async (payload, userId) => {
  const { data, error } = await supabase
    .from("receipts")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
