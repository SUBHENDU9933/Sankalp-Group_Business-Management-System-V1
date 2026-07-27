import { supabase } from "@/lib/supabase";

const BUCKET = "attachments";

// Uploads a File to the given folder in the attachments bucket and returns
// { url, path, name, type, size }. Uses a timestamped filename to avoid collisions.
export const uploadFile = async (file, folder = "misc") => {
  if (!file) throw new Error("No file");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, name: file.name, type: file.type, size: file.size };
};

export const deleteFile = async (path) => {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
};
