import { supabase } from '../lib/supabase';

export type Schedule = {
  id: string;
  title?: string | null;
  meeting_type?: string | null;
  mode?: string | null;
  status?: string | null;
  start_at: string;
  end_at?: string | null;
  lead_id?: string | null;
  owner_id?: string | null;
  meeting_link?: string | null;
  google_calendar_url?: string | null;
  owner?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  arranger?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  participants?: Array<{ user_id: string; participant_role?: string | null; is_required?: boolean | null; profile?: any }>;
};

export type EmployeeOption = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
};

const SCHEDULE_SELECT = `*, arranger:profiles!schedules_arranged_by_fkey(id,full_name,email,phone), owner:profiles!schedules_owner_id_fkey(id,full_name,email,phone), creator:profiles!schedules_created_by_fkey(id,full_name), participants:schedule_participants(user_id,participant_role,is_required,profile:profiles!schedule_participants_user_id_fkey(id,full_name,email,phone,role,is_admin))`;

export async function fetchSchedules(options: { from?: string; to?: string; status?: string; ownerId?: string } = {}) {
  let query = supabase.from('schedules').select(SCHEDULE_SELECT).is('deleted_at', null).order('start_at', { ascending: true });
  if (options.from) query = query.gte('start_at', options.from);
  if (options.to) query = query.lt('start_at', options.to);
  if (options.status) query = query.eq('status', options.status);
  if (options.ownerId) query = query.eq('owner_id', options.ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Schedule[];
}

export async function fetchUpcomingSchedules(limit = 10) {
  const { data, error } = await supabase.from('schedules').select(SCHEDULE_SELECT).is('deleted_at', null).gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data || []) as Schedule[];
}

export async function fetchScheduleById(id: string) {
  const { data, error } = await supabase.from('schedules').select(SCHEDULE_SELECT).eq('id', id).single();
  if (error) throw error;
  return data as Schedule;
}

export async function fetchActiveEmployees() {
  const { data, error } = await supabase.from('profiles').select('id,full_name,email,role,is_admin').eq('is_active', true).order('full_name');
  if (error) throw error;
  return (data || []) as EmployeeOption[];
}

export async function fetchMeetingRule(meetingType: string, mode: string) {
  const { data, error } = await supabase.from('schedule_meeting_rules').select('*').eq('meeting_type', meetingType).eq('mode', mode).eq('enabled', true).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function createSchedule(
  payload: Record<string, unknown>,
  participantIds: string[] = [],
  requiredParticipantIds: string[] = [],
) {
  const { data: id, error } = await supabase.rpc('create_schedule_with_participants', {
    p_payload: payload,
    p_participant_ids: [...new Set(participantIds.filter(Boolean))],
    p_required_participant_ids: [...new Set(requiredParticipantIds.filter(Boolean))],
  });
  if (error) throw error;
  if (!id) throw new Error('Schedule ID was not returned');

  // Keep Google Calendar/Meet as a server-side integration. The mobile app never
  // receives or stores Google OAuth secrets.
  let calendarSync: any = null;
  try {
    const result = await supabase.functions.invoke('google-calendar', {
      body: { action: 'create_event', schedule_id: id },
    });
    calendarSync = result.data || null;
  } catch (_) {
    // Schedule creation itself succeeded; calendar can be synced later.
  }

  return { schedule: await fetchScheduleById(id), calendarSync };
}

export async function checkCalendarAvailability(input: { start: string; end: string; userIds: string[] }) {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'availability', start: input.start, end: input.end, user_ids: input.userIds, exclude_event_id: null },
  });
  if (error) throw error;
  return data;
}

export async function fetchScheduleStats() {
  const { data, error } = await supabase.from('schedules').select('id,status,start_at,next_action_date').is('deleted_at', null);
  if (error) throw error;
  return data || [];
}
