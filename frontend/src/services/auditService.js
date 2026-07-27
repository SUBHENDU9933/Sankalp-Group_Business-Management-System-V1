import { supabase } from "@/lib/supabase";

export const fetchAuditLog = async ({ from, to, actorId, entityType, action, search } = {}) => {
  let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(1000);
  if (from) q = q.gte("created_at", from);
  if (to)   q = q.lte("created_at", to);
  if (actorId && actorId !== "all") q = q.eq("actor_id", actorId);
  if (entityType && entityType !== "all") q = q.eq("entity_type", entityType);
  if (action && action !== "all") q = q.eq("action", action);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) =>
      [r.entity_label, r.actor_email, r.actor_name, r.entity_type, r.action]
        .filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }
  return rows;
};
