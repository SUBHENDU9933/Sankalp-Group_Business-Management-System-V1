import { supabase } from '../lib/supabase';

export type DashboardData = {
  kpis?: {
    leads?: number;
    active_leads?: number;
    hot_leads?: number;
    followups_today?: number;
    overdue_followups?: number;
    pipeline_count?: number;
    converted?: number;
    conversion_rate?: number;
    [key: string]: unknown;
  };
  actions?: unknown[];
  pipeline?: unknown[];
  recent_activity?: unknown[];
};

export async function fetchDashboardData() {
  const { data, error } = await supabase.rpc('get_dashboard_data');
  if (error) throw error;
  return (data || {}) as DashboardData;
}
