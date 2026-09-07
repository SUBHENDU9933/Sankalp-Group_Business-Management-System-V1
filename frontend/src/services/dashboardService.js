import { supabase } from "@/lib/supabase";

export async function fetchDashboardData() {
  const { data, error } = await supabase.rpc("get_dashboard_data");
  if (error) throw error;
  return data || {};
}
