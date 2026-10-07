import { supabase } from '../lib/supabase';

export type BmsNotification = {
  id: string;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  link?: string | null;
  read?: boolean | null;
  created_at?: string | null;
};

export async function fetchNotifications(limit = 25) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as BmsNotification[];
}

export async function fetchUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) throw error;
}
