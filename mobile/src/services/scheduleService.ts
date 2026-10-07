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
  owner?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  arranger?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  participants?: Array<{ user_id: string; participant_role?: string | null; is_required?: boolean | null; profile?: any }>;
};

const SCHEDULE_SELECT = `*, arranger:profiles!schedules_arranged_by_fkey(id,full_name,email,phone), owner:profiles!schedules_owner_id_fkey(id,full_name,email,phone), creator:profiles!schedules_created_by_fkey(id,full_name), participants:schedule_participants(user_id,participant_role,is_required,profile:profiles!schedule_participants_user_id_fkey(id,full_name,email,phone,role,is_admin))`;

export async function fetchSchedules(options: {
  from?: string;
  to?: string;
  status?: string;
  ownerId?: string;
} = {}) {
  let query = supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (options.from) query = query.gte('start_at', options.from);
  if (options.to) query = query.lt('start_at', options.to);
  if (options.status) query = query.eq('status', options.status);
  if (options.ownerId) query = query.eq('owner_id', options.ownerId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Schedule[];
}

export async function fetchUpcomingSchedules(limit = 10) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .is('deleted_at', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Schedule[];
}

export async function fetchScheduleStats() {
  const { data, error } = await supabase
    .from('schedules')
    .select('id,status,start_at,next_action_date')
    .is('deleted_at', null);
  if (error) throw error;
  return data || [];
}
