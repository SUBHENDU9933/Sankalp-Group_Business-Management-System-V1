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

// Push a notification to every admin (defense-in-depth client-side fallback
// in case the Postgres notify trigger isn't installed / firing).
export const pushToAllAdmins = async ({ title, body, link, type = "info" }) => {
  try {
    const { data: admins, error: aErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (aErr || !admins?.length) return;
    const rows = admins.map((a) => ({ user_id: a.id, type, title, body, link }));
    await supabase.from("notifications").insert(rows);
  } catch (e) {
    console.warn("pushToAllAdmins failed:", e);
  }
};
