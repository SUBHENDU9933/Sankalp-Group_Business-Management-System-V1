import { supabase } from "@/lib/supabase";
import { pushToAllAdmins } from "@/services/notificationService";

const attachLeadAssignees = async (leads) => {
  const rows = leads || [];
  if (!rows.length) return rows;

  const leadIds = rows.map((lead) => lead.id).filter(Boolean);
  const byLead = new Map();

  // Keep each PostgREST request small. Admins can have hundreds/thousands of
  // leads, and one huge `.in("lead_id", leadIds)` request can exceed URL/request
  // limits and return 400 Bad Request. Batching also preserves the co-assignee
  // data required by User Wise Filter without changing RLS or the database.
  const batchSize = 100;
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data: assignees, error } = await supabase
      .from("lead_assignees")
      .select("lead_id,user_id,added_at,profile:profiles!lead_assignees_user_id_fkey(id,full_name,email)")
      .in("lead_id", batch);

    // Never silently turn an assignment-query failure into an empty assignee list.
    // Doing that makes assigned leads look unassigned and breaks User Wise Filter.
    if (error) throw error;

    for (const row of assignees || []) {
      const list = byLead.get(row.lead_id) || [];
      list.push(row);
      byLead.set(row.lead_id, list);
    }
  }

  return rows.map((lead) => ({
    ...lead,
    assignees: byLead.get(lead.id) || [],
  }));
};

const fetchLeadRows = async (includeDeletedFilter = true, filters = {}) => {
  let q = supabase
    .from("leads")
    .select(
      "*, assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email), creator:profiles!leads_created_by_fkey(id,full_name,email)"
    )
    .order("created_at", { ascending: false });

  if (includeDeletedFilter) q = q.is("deleted_at", null);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.includeDeleteRequested === false) q = q.eq("delete_request", false);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const fetchLeads = async (filters = {}) => {
  let rows;
  try {
    rows = await fetchLeadRows(true, filters);
  } catch (error) {
    // Keep compatibility with older databases where deleted_at may not exist.
    if (!/deleted_at/i.test(error.message || "")) throw error;
    rows = await fetchLeadRows(false, filters);
  }

  // Fetch lead_assignees separately instead of using a nested PostgREST relation.
  // This keeps assignment state reliable for both the table and User Wise Filter.
  return attachLeadAssignees(rows);
};

export const addLeadAssignee = async (leadId, userId, addedBy) => {
  const { error } = await supabase
    .from("lead_assignees")
    .insert([{ lead_id: leadId, user_id: userId, assigned_by: addedBy }]);
  if (error && !/duplicate key/i.test(error.message)) throw error;
};

export const removeLeadAssignee = async (leadId, userId) => {
  const { error } = await supabase
    .from("lead_assignees")
    .delete()
    .eq("lead_id", leadId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const bulkAddCoAssignee = async (leadIds, userId, addedBy) => {
  if (!leadIds?.length || !userId) return 0;
  const rows = leadIds.map((lead_id) => ({ lead_id, user_id: userId, assigned_by: addedBy }));
  const { error } = await supabase
    .from("lead_assignees")
    .upsert(rows, { onConflict: "lead_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
};

export const createLead = async (payload, _userId) => {
  // Use the live Supabase Auth identity. Do not trust a caller-supplied creator id.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.id) throw authError || new Error("Your login session has expired. Please sign in again.");

  // Do not use INSERT ... RETURNING (.select()) here. The lead SELECT policy
  // delegates to a helper that reads the leads table, and PostgreSQL can evaluate
  // that helper before the just-inserted row is visible. That produces the misleading
  // "new row violates row-level security" error even though INSERT itself is allowed.
  // Insert first, then read the row in a separate authenticated SELECT.
  const leadId = crypto.randomUUID();
  const { error } = await supabase
    .from("leads")
    .insert([{ ...payload, id: leadId, created_by: user.id }]);
  if (error) throw error;

  const { data, error: fetchError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (fetchError) throw fetchError;
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

export const bulkInsertLeads = async (rows, _userId) => {
  if (!rows?.length) return { inserted: 0, skipped: 0, errors: [] };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.id) throw authError || new Error("Your login session has expired. Please sign in again.");

  const { data: existing, error: e1 } = await supabase.from("leads").select("phone");
  if (e1) throw e1;
  const seen = new Set((existing || []).map((r) => (r.phone || "").trim()).filter(Boolean));
  const toInsert = [];
  let skipped = 0;
  for (const r of rows) {
    const phone = (r.phone || "").trim();
    if (phone && seen.has(phone)) { skipped += 1; continue; }
    if (phone) seen.add(phone);
    toInsert.push({ ...r, created_by: user.id });
  }
  if (!toInsert.length) return { inserted: 0, skipped, errors: [] };
  let inserted = 0;
  const errors = [];
  for (let i = 0; i < toInsert.length; i += 100) {
    const slice = toInsert.slice(i, i + 100);
    // Bulk INSERT must also avoid RETURNING because the same lead SELECT RLS
    // helper can reject the response row during the insert statement.
    const { error } = await supabase.from("leads").insert(slice);
    if (error) errors.push(error.message);
    else inserted += slice.length;
  }
  return { inserted, skipped, errors };
};

export const updateLeadStatus = async (id, status, userId) => {
  const lead = await updateLead(id, { status });
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

export const adminDeleteLead = async (id, userId) => {
  const { error } = await supabase.from("leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

export const convertLeadToCustomer = async (lead, userId) => {
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
  const { error: lErr } = await supabase
    .from("leads")
    .update({ status: "converted", is_locked: true })
    .eq("id", lead.id);
  if (lErr) throw lErr;
  await supabase.from("receipts").update({ customer_id: customer.id }).eq("lead_id", lead.id).is("customer_id", null);
  return customer;
};
