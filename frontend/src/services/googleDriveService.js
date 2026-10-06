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

export const uploadToGoogleDrive = async ({ file, module = "misc", recordId, leadId, source = "employee", category = "other", onProgress } = {}) => {
  if (!file) throw new Error("No file selected");
  const form = new FormData();
  form.set("action", "start_upload");
  form.set("module", module);
  if (recordId) form.set("record_id", recordId);
  if (leadId) form.set("lead_id", leadId);
  form.set("source", source);
  form.set("category", category);
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

  const response = await fetch(data.session_url, {
    method: "PUT",
    headers: { "Content-Length": String(file.size), "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || ("Google Drive upload returned " + response.status));
  }

  let uploaded = {};
  try { uploaded = await response.json(); } catch (_) {}
  const finalizeBody = {
    action: "finalize_upload",
    module,
    record_id: recordId || "",
    lead_id: leadId || "",
    source,
    category,
    session_url: data.session_url,
    drive_file_id: uploaded?.id || "",
    drive_file_name: uploaded?.name || file.name,
    drive_mime_type: uploaded?.mimeType || file.type || "application/octet-stream",
    drive_size: String(uploaded?.size || file.size),
    drive_web_view_link: uploaded?.webViewLink || "",
    drive_parent_id: (uploaded?.parents || [])[0] || data.parent_folder_id || "",
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: String(file.size),
  };
  const { data: finalized, error: finalizeError } = await supabase.functions.invoke("google-drive-storage", {
    body: finalizeBody,
  });
  if (finalizeError) {
    let message = finalizeError.message;
    try { const details = await finalizeError.context?.json?.(); message = details?.error || message; } catch (_) {}
    throw new Error(message || "Google Drive upload could not be finalized");
  }
  if (!finalized?.drive_file_id) throw new Error("Google Drive upload completed but file metadata was not registered");

  onProgress?.(100);
  return {
    provider: "google_drive",
    driveFileId: finalized.drive_file_id,
    driveUrl: finalized.drive_url,
    driveParentId: finalized.drive_parent_id || data.parent_folder_id,
    name: finalized.name || file.name,
    type: finalized.type || file.type,
    size: Number(finalized.size || file.size),
    scheduleFile: finalized.schedule_file || null,
  };
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

export const fetchGoogleDriveFileBlob = async ({ fileId, recordId, leadId, disposition = "inline" } = {}) => {
  if (!fileId || !recordId) throw new Error("File reference is missing");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Authentication required");
  const base = String(process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(base + "/functions/v1/google-drive-storage", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action: disposition === "inline" ? "preview" : "download", module: leadId ? "lead" : "schedule", record_id: recordId || "", lead_id: leadId || "", file_id: fileId }),
  });
  if (!response.ok) {
    let message = "Could not download file";
    try { const body = await response.json(); message = body?.error || message; } catch (_) {}
    throw new Error(message);
  }
  return response.blob();
};

export const downloadGoogleDriveFile = async ({ fileId, recordId, leadId } = {}) => {
  if (!fileId || !recordId) throw new Error("File reference is missing");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Authentication required");
  const base = String(process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
  const response = await fetch(base + "/functions/v1/google-drive-storage", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action: leadId ? "download" : "download", module: leadId ? "lead" : "schedule", record_id: recordId || "", lead_id: leadId || "", file_id: fileId }),
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
  const previewWindow = window.open("about:blank", "_blank");
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

export const fetchGoogleDriveQuota = async () => {
  const { data, error } = await supabase.functions.invoke("google-drive-oauth", { body: { action: "quota" } });
  if (error) throw error;
  return data;
};
