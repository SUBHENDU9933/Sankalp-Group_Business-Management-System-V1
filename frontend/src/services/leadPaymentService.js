import { supabase } from "@/lib/supabase";

// Total amount collected against leads. When leadIds are supplied, only fetch
// receipts for the currently visible page so large lead lists never download
// the entire receipts table.
export const fetchLeadPaymentTotals = async (leadIds = null) => {
  let q = supabase
    .from("receipts")
    .select("lead_id, amount")
    .not("lead_id", "is", null)
    .is("deleted_at", null);

  if (Array.isArray(leadIds)) {
    if (!leadIds.length) return {};
    q = q.in("lead_id", leadIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => {
    map[r.lead_id] = (map[r.lead_id] || 0) + Number(r.amount || 0);
  });
  return map;
};
