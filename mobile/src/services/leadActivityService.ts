import { supabase } from '../lib/supabase';

export type LeadActivity = {
  id: string;
  lead_id: string;
  type?: string | null;
  content?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  creator?: { id: string; full_name?: string | null; email?: string | null } | null;
};

export async function fetchLeadActivities(leadId: string) {
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*, creator:profiles!lead_activities_created_by_fkey(id,full_name,email)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as LeadActivity[];
}
