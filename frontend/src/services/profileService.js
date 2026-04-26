import { supabase } from "@/lib/supabase";

export const fetchProfiles = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const updateProfileRole = async (id, role) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (id, payload) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

/**
 * Upload signature image to the public 'signatures' bucket.
 * Path: {userId}/sign.{ext} (overwrites previous file).
 * Returns the public URL persisted on the profile.
 */
export const uploadSignature = async (userId, file) => {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/sign.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("signatures")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("signatures").getPublicUrl(path);
  // Add cache-buster so refreshes pick up new image
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await updateProfile(userId, { signature_url: url });
  return url;
};

/**
 * Send a password reset email via Supabase Auth.
 * Frontend redirect lands on /login with a recovery token Supabase handles.
 */
export const sendPasswordReset = async (email) => {
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
};
