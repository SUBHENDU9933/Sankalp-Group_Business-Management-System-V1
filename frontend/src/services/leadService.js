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

/**
 * Bulk update — applies same `payload` to every id in `ids`.
 * Returns count of rows updated.
 */
export const bulkUpdateLeads = async (ids, payload) => {
  if (!ids?.length) return 0;
  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .in("id", ids)
    .select("id");
  if (error) throw error;
  return data?.length || 0;
};

/**
 * Bulk insert leads. Returns { inserted, skipped, errors }.
 * Deduplicates by phone against existing leads (only if existing phone is set).
 */
export const bulkInsertLeads = async (rows, userId) => {
  if (!rows?.length) return { inserted: 0, skipped: 0, errors: [] };
  // Pre-fetch existing phones to deduplicate (light: select only phone)
  const { data: existing, error: e1 } = await supabase.from("leads").select("phone");
  if (e1) throw e1;
  const seen = new Set((existing || []).map((r) => (r.phone || "").trim()).filter(Boolean));
  const toInsert = [];
  let skipped = 0;
  for (const r of rows) {
    const phone = (r.phone || "").trim();
    if (phone && seen.has(phone)) { skipped += 1; continue; }
    if (phone) seen.add(phone);
    toInsert.push({ ...r, created_by: userId });
  }
  if (!toInsert.length) return { inserted: 0, skipped, errors: [] };
  // Insert in batches of 100 to stay under Postgres limits
  let inserted = 0;
  const errors = [];
  for (let i = 0; i < toInsert.length; i += 100) {
    const slice = toInsert.slice(i, i + 100);
    const { data, error } = await supabase.from("leads").insert(slice).select("id");
    if (error) errors.push(error.message);
    else inserted += data?.length || 0;
  }
  return { inserted, skipped, errors };
};

export const updateLeadStatus = async (id, status, userId) => {
  const lead = await updateLead(id, { status });
  // Log status change to timeline (best-effort)
  if (userId) {
    try {
      await supabase.from("lead_activities").insert([{
        lead_id: id,
        type: "status_change",
        content: `Status changed to ${status.replace(/_/g, " ")}`,
        created_by: userId,
      }]);
    } catch (_) { /* ignore */ }
  }
  return lead;
};

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
