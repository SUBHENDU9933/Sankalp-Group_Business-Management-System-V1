import { supabase } from "@/lib/supabase";

// Only info.subhendu@gmail.com is authorized server-side (enforced inside
// the RPC itself, not just by hiding the UI) — see admin_send_notification.
export const SUPER_ADMIN_EMAIL = "info.subhendu@gmail.com";

export const fetchAllUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");
  if (error) throw error;
  return data || [];
};

export const sendBroadcast = async ({ userIds, title, body, link, sendAt }) => {
  const { data, error } = await supabase.rpc("admin_send_notification", {
    p_user_ids: userIds,
    p_title: title,
    p_body: body || null,
    p_link: link || null,
    p_send_at: sendAt || null,
  });
  if (error) throw error;
  return data;
};

export const fetchMyBroadcasts = async () => {
  const { data, error } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
};
