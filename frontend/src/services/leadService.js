import { supabase } from "@/lib/supabase";

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

export const requestDelete = async (id, userId) => {
  return updateLead(id, {
    delete_request: true,
    delete_requested_by: userId,
    delete_requested_at: new Date().toISOString(),
  });
};

export const cancelDeleteRequest = async (id) => {
  return updateLead(id, {
    delete_request: false,
    delete_requested_by: null,
    delete_requested_at: null,
  });
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
