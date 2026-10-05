import { supabase } from "@/lib/supabase";

export const fetchGoogleDriveStatus = async () => {
  const { data, error } = await supabase.functions.invoke("google-drive-oauth", { body: { action: "status" } });
  if (error) throw error;
  return data;
};

export const startGoogleDriveOAuth = async () => {
  const { data, error } = await supabase.functions.invoke("google-drive-oauth", { body: { action: "start" } });
  if (error) throw error;
  if (!data?.authorization_url) throw new Error("Google Drive authorization URL was not returned");
  window.location.assign(data.authorization_url);
};

export const disconnectGoogleDrive = async () => {
  const { data, error } = await supabase.functions.invoke("google-drive-oauth", { body: { action: "disconnect" } });
  if (error) throw error;
  return data;
};

export const uploadToGoogleDrive = async ({ file, module = "misc", recordId, onProgress } = {}) => {
  if (!file) throw new Error("No file selected");
  const form = new FormData();
  form.set("action", "start_upload");
  form.set("module", module);
  if (recordId) form.set("record_id", recordId);
  form.set("file_name", file.name);
  form.set("mime_type", file.type || "application/octet-stream");
  form.set("size", String(file.size));
  const { data, error } = await supabase.functions.invoke("google-drive-storage", { body: form });
  if (error) {
    let message = error.message;
    try { const details = await error.context?.json?.(); message = details?.error || message; } catch (_) {}
    throw new Error(message || "Could not start Google Drive upload");
  }
  if (!data?.session_url) throw new Error("Google Drive upload session was not created");
  const response = await fetch(data.session_url, { method: "PUT", headers: { "Content-Length": String(file.size) }, body: file });
  if (!response.ok) { const body = await response.text().catch(() => ""); throw new Error(body || ("Google Drive upload failed (" + response.status + ")")); }
  const uploaded = await response.json();
  onProgress?.(100);
  return { provider: "google_drive", driveFileId: uploaded.id, driveUrl: uploaded.webViewLink || ("https://drive.google.com/open?id=" + uploaded.id), driveParentId: data.parent_folder_id, name: uploaded.name || file.name, type: uploaded.mimeType || file.type, size: Number(uploaded.size || file.size) };
};

export const deleteGoogleDriveFile = async ({ driveFileId, module = "misc", recordId } = {}) => {
  if (!driveFileId) return;
  const form = new FormData();
  form.set("action", "delete");
  form.set("module", module);
  if (recordId) form.set("record_id", recordId);
  form.set("drive_file_id", driveFileId);
  const { data, error } = await supabase.functions.invoke("google-drive-storage", { body: form });
  if (error) throw error;
  return data;
};

export const downloadGoogleDriveFile = async ({ fileId, recordId } = {}) => {
  if (!fileId || !recordId) throw new Error("File reference is missing");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Authentication required");
  const base = String(process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(base + "/functions/v1/google-drive-storage", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "download", module: "schedule", record_id: recordId }),
  });
  if (!response.ok) {
    let message = "Could not download file";
    try { const body = await response.json(); message = body?.error || message; } catch (_) {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const name = match?.[1] || "download";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
