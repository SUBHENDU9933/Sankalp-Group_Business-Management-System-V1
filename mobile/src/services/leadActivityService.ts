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

export async function addLeadActivity(input: {
  leadId: string;
  type: string;
  content?: string;
  meta?: Record<string, unknown>;
  userId: string;
}) {
  const { data, error } = await supabase
    .from('lead_activities')
    .insert([{
      lead_id: input.leadId,
      type: input.type,
      content: input.content?.trim() || null,
      meta: input.meta || null,
      created_by: input.userId,
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data as LeadActivity;
}

export async function logLeadCallOutcome(input: {
  leadId: string;
  outcome: 'connected' | 'not_connected';
  userId: string;
  note?: string;
}) {
  const { leadId, outcome, userId, note } = input;
  if (!leadId || !['connected', 'not_connected'].includes(outcome)) {
    throw new Error('Invalid call outcome');
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id,status')
    .eq('id', leadId)
    .single();
  if (leadError) throw leadError;

  const { count: previousCalls, error: countError } = await supabase
    .from('lead_activities')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('type', 'call');
  if (countError) throw countError;

  const attemptNumber = (previousCalls || 0) + 1;
  const currentStatus = lead.status;
  const isFirstCall = attemptNumber === 1;
  const firstCallStatus = outcome === 'connected' ? 'contacted' : 'not_contacted';
  const shouldPromoteToContacted =
    outcome === 'connected' && ['new', 'not_contacted'].includes(currentStatus);
  const shouldSetFirstCallStatus = isFirstCall && currentStatus === 'new';
  const shouldChangeStatus = shouldSetFirstCallStatus || shouldPromoteToContacted;
  const resultingStatus = shouldChangeStatus ? firstCallStatus : currentStatus;

  if (shouldChangeStatus) {
    const statusPayload: Record<string, unknown> = { status: firstCallStatus };
    if (outcome === 'connected') {
      statusPayload.last_contact_date = new Date().toISOString().slice(0, 10);
    }
    const { error: statusError } = await supabase
      .from('leads')
      .update(statusPayload)
      .eq('id', leadId);
    if (statusError) throw statusError;
  } else if (outcome === 'connected') {
    const { error: contactError } = await supabase
      .from('leads')
      .update({ last_contact_date: new Date().toISOString().slice(0, 10) })
      .eq('id', leadId);
    if (contactError) throw contactError;
  }

  const outcomeLabel = outcome === 'connected' ? 'Connected' : 'Not Connected';
  const content = note?.trim()
    ? `Call Attempt #${attemptNumber} — ${outcomeLabel} — ${note.trim()}`
    : `Call Attempt #${attemptNumber} — ${outcomeLabel}`;

  return addLeadActivity({
    leadId,
    type: 'call',
    content,
    userId,
    meta: {
      outcome,
      attempt_number: attemptNumber,
      previous_status: currentStatus,
      resulting_status: resultingStatus,
      status_changed: shouldChangeStatus,
      first_successful_contact: shouldPromoteToContacted,
    },
  });
}
