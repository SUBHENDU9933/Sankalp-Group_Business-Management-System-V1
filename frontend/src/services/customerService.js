import { supabase } from "@/lib/supabase";
import { pushToAllAdmins } from "@/services/notificationService";

const CUSTOMER_SELECT = `*, creator:profiles!customers_created_by_fkey(id,full_name,email,role), assigned_profile:profiles!customers_assigned_to_fkey(id,full_name,email,role), assignees:customer_assignees(user_id,assigned_by,added_at,profile:profiles!customer_assignees_user_id_fkey(id,full_name,email,role))`;

export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error && /deleted_at/i.test(error.message)) {
    const r = await supabase.from("customers")
      .select(CUSTOMER_SELECT)
      .order("created_at", { ascending: false });
    if (r.error) throw r.error; return r.data || [];
  }
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

export const addCustomerAssignee = async (customerId, userId, assignedBy) => {
  const { data, error } = await supabase
    .from("customer_assignees")
    .insert([{ customer_id: customerId, user_id: userId, assigned_by: assignedBy }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const removeCustomerAssignee = async (customerId, userId) => {
  const { error } = await supabase
    .from("customer_assignees")
    .delete()
    .eq("customer_id", customerId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const requestDeleteCustomer = async (id, _userId) => {
  const { error } = await supabase.rpc("request_delete_customer", { p_id: id });
  if (error) throw error;
  const { data: cust } = await supabase.from("customers").select("name").eq("id", id).maybeSingle();
  await pushToAllAdmins({
    type: "delete_request",
    title: `Customer delete request: ${cust?.name || ""}`,
    body: "Awaiting your approval in /approvals",
    link: "/approvals",
  });
};

export const cancelDeleteCustomer = async (id) => {
  const { error } = await supabase.rpc("cancel_delete_customer", { p_id: id });
  if (error) throw error;
};

export const adminDeleteCustomer = async (id, userId) => {
  const { error } = await supabase.from("customers")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
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
