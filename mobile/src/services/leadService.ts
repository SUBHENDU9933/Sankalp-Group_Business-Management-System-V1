import { supabase } from '../lib/supabase';

export type Lead = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  area?: string | null;
  project_type?: string | null;
  requirement?: string | null;
  status?: string | null;
  next_followup_date?: string | null;
  reminder_note?: string | null;
  last_contact_date?: string | null;
  created_at?: string | null;
  assigned_to?: string | null;
  assigned_profile?: { id: string; full_name?: string | null; email?: string | null } | null;
  assignees?: Array<{
    user_id: string;
    profile?: { id: string; full_name?: string | null; email?: string | null } | null;
  }>;
};

const LEAD_SELECT = `*, assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email), creator:profiles!leads_created_by_fkey(id,full_name,email)`;

export async function fetchLeads(filters: { status?: string } = {}) {
  let query = supabase
    .from('leads')
    .select(LEAD_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error && /deleted_at/i.test(error.message)) {
    let fallback = supabase
      .from('leads')
      .select(LEAD_SELECT)
      .order('created_at', { ascending: false });
    if (filters.status) fallback = fallback.eq('status', filters.status);
    const result = await fallback;
    if (result.error) throw result.error;
    return (result.data || []) as Lead[];
  }
  if (error) throw error;

  const rows = (data || []) as Lead[];
  if (!rows.length) return rows;

  const ids = rows.map((lead) => lead.id).filter(Boolean);
  const assignees: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const result = await supabase
      .from('lead_assignees')
      .select('lead_id,user_id,profile:profiles!lead_assignees_user_id_fkey(id,full_name,email)')
      .in('lead_id', batch);
    if (result.error) throw result.error;
    assignees.push(...(result.data || []));
  }

  const byLead = new Map<string, any[]>();
  for (const row of assignees) {
    const list = byLead.get(row.lead_id) || [];
    list.push(row);
    byLead.set(row.lead_id, list);
  }
  return rows.map((lead) => ({ ...lead, assignees: byLead.get(lead.id) || [] }));
}

export async function fetchLeadById(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function updateLeadStatus(id: string, status: string) {
  const { error } = await supabase.from('leads').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateLeadFollowUp(id: string, nextFollowupDate: string | null, reminderNote: string | null) {
  const { error } = await supabase
    .from('leads')
    .update({
      next_followup_date: nextFollowupDate,
      reminder_note: reminderNote?.trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchActiveLeadCount() {
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .not('status', 'in', '(lost,converted)');
  if (error) throw error;
  return count || 0;
}
