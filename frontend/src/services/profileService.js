import { supabase } from "@/lib/supabase";

export const fetchProfiles = async () => {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const updateProfileRole = async (id, role) => {
  if (!["admin", "rm", "re"].includes(role)) throw new Error("Invalid role");
  const { data: actor, error: actorError } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id).maybeSingle();
  if (actorError) throw actorError;
  if (actor?.role !== "admin") throw new Error("Only an administrator can change team roles");
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (id, payload) => {
  const { data, error } = await supabase.from("profiles").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
};

export const uploadSignature = async (userId, file) => {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/sign.${ext}`;
  const { error: upErr } = await supabase.storage.from("signatures").upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("signatures").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await updateProfile(userId, { signature_url: url });
  return url;
};

/** Change the currently signed-in user's password after re-authentication. */
export const changeOwnPassword = async ({ currentPassword, newPassword }) => {
  const { data: authData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const currentUser = authData?.user;
  if (!currentUser?.email) throw new Error("Unable to identify the signed-in user");

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  });
  if (verifyError) throw new Error("Current password is incorrect");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

/** Admin-only password reset for another team member. Requires the admin-set-password Edge Function. */
export const adminSetUserPassword = async (userId, newPassword) => {
  const { data, error } = await supabase.functions.invoke("admin-set-password", {
    body: { user_id: userId, new_password: newPassword },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};
