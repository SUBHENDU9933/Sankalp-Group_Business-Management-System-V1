import { supabase } from "@/lib/supabase";

const BATCH_SIZE = 100;

const attachAssignees = async (rows) => {
  if (!rows.length) return rows;
  const byLead = new Map();
  const ids = rows.map((row) => row.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("lead_assignees")
      .select("lead_id,user_id,added_at,profile:profiles!lead_assignees_user_id_fkey(id,full_name,email)")
      .in("lead_id", batch);
    if (error) throw error;
    for (const item of data || []) {
      const list = byLead.get(item.lead_id) || [];
      list.push(item);
      byLead.set(item.lead_id, list);
    }
  }
  return rows.map((row) => ({ ...row, assignees: byLead.get(row.id) || [] }));
};

export const fetchLeadSegment = async ({ segment = "active", page = 1, pageSize = 100, search = "" } = {}) => {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 100, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("leads")
    .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email), creator:profiles!leads_created_by_fkey(id,full_name,email)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (segment === "lost") query = query.eq("status", "lost");
  else query = query.neq("status", "lost");

  const term = String(search || "").trim();
  if (term) {
    const escaped = term.replace(/,/g, " ").replace(/%/g, "\\%");
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,location.ilike.%${escaped}%,area.ilike.%${escaped}%,pincode.ilike.%${escaped}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: await attachAssignees(data || []), count: count || 0, page: safePage, pageSize: safePageSize };
};

export const reviveLostLead = async (leadId, userId, nextStatus = "contacted") => {
  if (!leadId) throw new Error("Lead ID is required");
  const allowed = ["new", "contacted", "site_visit", "quotation_given", "negotiation", "not_contacted", "floor_plan_site_info", "estimate_to_be_created", "need_followup"];
  const status = allowed.includes(nextStatus) ? nextStatus : "contacted";
  const { data, error } = await supabase
    .from("leads")
    .update({ status, is_locked: false, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("status", "lost")
    .select("*")
    .single();
  if (error) throw error;

  if (userId) {
    const { error: activityError } = await supabase.from("lead_activities").insert([{
      lead_id: leadId,
      type: "status_change",
      content: `Lead revived from lost to ${status.replace(/_/g, " ")}`,
      meta: { from_status: "lost", to_status: status, action: "revive" },
      created_by: userId,
    }]);
    if (activityError) throw activityError;
  }
  return data;
};
