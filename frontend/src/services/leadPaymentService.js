import { supabase } from "@/lib/supabase";

// Total amount collected against each not-yet-converted lead (visit charge /
// consultancy charge etc.) — used to show a paid-indicator badge on the
// Leads table/pipeline so staff can see at a glance without opening each lead.
export const fetchLeadPaymentTotals = async () => {
  const { data, error } = await supabase
    .from("receipts")
    .select("lead_id, amount")
    .not("lead_id", "is", null)
    .is("deleted_at", null);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => {
    map[r.lead_id] = (map[r.lead_id] || 0) + Number(r.amount || 0);
  });
  return map;
};
