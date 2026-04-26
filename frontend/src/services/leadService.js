import { supabase } from "@/lib/supabase";
import { pushToAllAdmins } from "@/services/notificationService";

export const fetchLeads = async (filters = {}) => {
  let q = supabase
    .from("leads")
    .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email), creator:profiles!leads_created_by_fkey(id,full_name,email)")
    .order("created_at", { ascending: false });
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.includeDeleteRequested === false) q = q.eq("delete_request", false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createLead = async (payload, userId) => {
  const { data, error } = await supabase
    .from("leads")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateLead = async (id, payload) => {
  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateLeadStatus = async (id, status) => updateLead(id, { status });

export const requestDelete = async (id, _userId) => {
  const { error } = await supabase.rpc("request_delete_lead", { p_id: id });
  if (error) throw error;
  // Look up lead name for a friendlier notification title
  const { data: lead } = await supabase.from("leads").select("name").eq("id", id).maybeSingle();
  await pushToAllAdmins({
    type: "delete_request",
    title: `Lead delete request: ${lead?.name || ""}`,
    body: "Awaiting your approval in /approvals",
    link: "/approvals",
  });
};

export const cancelDeleteRequest = async (id) => {
  const { error } = await supabase.rpc("cancel_delete_lead", { p_id: id });
  if (error) throw error;
};

export const adminDeleteLead = async (id) => {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
};

export const convertLeadToCustomer = async (lead, userId) => {
  // Insert customer
  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .insert([{
      name: lead.name,
      phone: lead.phone,
      address: lead.location,
      project_details: `${lead.project_type || ""} — ${lead.requirement || ""}`.trim(),
      linked_lead_id: lead.id,
      created_by: userId,
    }])
    .select("*")
    .single();
  if (cErr) throw cErr;
  // Lock lead
  const { error: lErr } = await supabase
    .from("leads")
    .update({ status: "converted", is_locked: true })
    .eq("id", lead.id);
  if (lErr) throw lErr;
  return customer;
};
