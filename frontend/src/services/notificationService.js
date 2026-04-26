import { supabase } from "@/lib/supabase";

export const fetchNotifications = async (limit = 25) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const unreadCount = async () => {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count || 0;
};

export const markRead = async (id) => {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
};

export const markAllRead = async () => {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) throw error;
};
