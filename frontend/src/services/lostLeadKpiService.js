import { supabase } from "@/lib/supabase";

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

export const fetchLostLeadKpis = async () => {
  const [totalRes, poolRes, todayRes, monthRes, reclaimedRes, valueRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "lost"),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "lost").is("assigned_to", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "lost").gte("lost_at", startOfToday()),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "lost").gte("lost_at", startOfMonth()),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).not("lost_at", "is", null).neq("status", "lost"),
    supabase.from("leads").select("budget").is("deleted_at", null).eq("status", "lost"),
  ]);

  for (const result of [totalRes, poolRes, todayRes, monthRes, reclaimedRes, valueRes]) {
    if (result.error) throw result.error;
  }

  const lostValue = (valueRes.data || []).reduce((sum, row) => sum + Number(row.budget || 0), 0);

  return {
    totalLost: totalRes.count || 0,
    availablePool: poolRes.count || 0,
    lostToday: todayRes.count || 0,
    lostThisMonth: monthRes.count || 0,
    reclaimed: reclaimedRes.count || 0,
    lostValue,
  };
};
