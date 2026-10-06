import { supabase } from "@/lib/supabase";

const invokeStorage = async (body) => {
  const { data, error } = await supabase.functions.invoke("google-drive-storage", { body });
  if (error) {
    let message = error.message;
    try { const details = await error.context?.json?.(); message = details?.error || message; } catch (_) {}
    throw new Error(message || "Google Drive operation failed");
  }
  return data;
};

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Authentication required");
  return token;
};

const storageUrl = () => {
  const base = String(process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Supabase URL is not configured");
  return base + "/functions/v1/google-drive-storage";
};

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
    headers: { "Content-Length": String(file.size), "Content-Range": "bytes 0-" + (file.size - 1) + "/" + file.size },
    body: file,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || ("Google Drive upload returned " + response.status));
  }
  const driveMeta = await response.json().catch(() => null);
  if (!driveMeta?.id) throw new Error("Google Drive upload completed without a file ID");

  const { data: finalized, error: finalizeError } = await supabase.functions.invoke("google-drive-storage", {
    body: {
      action: "register",
      module,
      record_id: recordId || "",
      lead_id: leadId || "",
      source,
      category,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size: String(file.size),
      drive_file_id: driveMeta.id,
      drive_url: driveMeta.webViewLink || ("https://drive.google.com/open?id=" + driveMeta.id),
      drive_parent_id: driveMeta.parents?.[0] || data.parent_folder_id || null,
    },
  });
  if (finalizeError) {
    let message = finalizeError.message;
    try { const details = await finalizeError.context?.json?.(); message = details?.error || message; } catch (_) {}
    throw new Error(message || "Google Drive upload completed but BMS registration failed");
  }
  if (!finalized?.bms_file_id) throw new Error("Google Drive upload completed but BMS registration failed");
  onProgress?.(100);
  return finalized;
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

export const downloadGoogleDriveFile = async ({ fileId, recordId, leadId } = {}) => {
  if (!fileId || !recordId) throw new Error("File reference is missing");
  const token = await getAccessToken();
  const response = await fetch(storageUrl(), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "download", module: leadId ? "lead" : "schedule", record_id: recordId, lead_id: leadId || "", file_id: fileId }),
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
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const fetchGoogleDriveQuota = async () => {
  const { data, error } = await supabase.functions.invoke("google-drive-oauth", { body: { action: "quota" } });
  if (error) throw error;
  return data;
};

export const fetchLeadFiles = async (leadId) => {
  if (!leadId) throw new Error("Lead reference is missing");
  const data = await invokeStorage({ action: "list", lead_id: leadId });
  return data?.files || [];
};

const openLeadFile = async (fileId, preview = false) => {
  if (!fileId) throw new Error("File reference is missing");
  const token = await getAccessToken();
  const response = await fetch(storageUrl(), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action: preview ? "preview" : "download", file_id: fileId }),
  });
  if (!response.ok) {
    let message = "Could not open file";
    try { const body = await response.json(); message = body?.error || message; } catch (_) {}
    throw new Error(message);
  }
  return response;
};

export const downloadLeadFile = async ({ fileId, preview = false } = {}) => {
  const response = await openLeadFile(fileId, preview);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const name = match?.[1] || "download";
  const url = URL.createObjectURL(blob);
  if (preview) {
    const win = window.open("about:blank", "_blank");
    if (win && !win.closed) win.location.href = url; else window.location.href = url;
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const getLeadFileBlob = async (fileId) => {
  const response = await openLeadFile(fileId, true);
  return response.blob();
};

export const uploadLeadFile = async ({ file, leadId, category, onProgress } = {}) => {
  if (!file) throw new Error("No file selected");
  if (!leadId) throw new Error("Lead reference is missing");
  if (!category) throw new Error("File category is required");

  const started = await invokeStorage({
    action: "start_upload",
    lead_id: leadId,
    category,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: String(file.size),
  });
  if (!started?.session_url) throw new Error("Google Drive upload session was not created");

  const response = await fetch(started.session_url, {
    method: "PUT",
    headers: { "Content-Length": String(file.size), "Content-Range": "bytes 0-" + (file.size - 1) + "/" + file.size },
    body: file,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || ("Google Drive upload returned " + response.status));
  }
  const driveMeta = await response.json().catch(() => null);
  if (!driveMeta?.id) throw new Error("Google Drive upload completed without a file ID");

  const registered = await invokeStorage({
    action: "register",
    lead_id: leadId,
    category,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: String(file.size),
    drive_file_id: driveMeta.id,
    drive_url: driveMeta.webViewLink || ("https://drive.google.com/open?id=" + driveMeta.id),
    drive_parent_id: driveMeta.parents?.[0] || started.parent_folder_id || null,
  });
  if (!registered?.bms_file_id) throw new Error("Google Drive upload completed but BMS registration failed");
  onProgress?.(100);
  return registered;
};

export const deleteLeadFile = async (fileId) => {
  if (!fileId) throw new Error("File reference is missing");
  return invokeStorage({ action: "delete", file_id: fileId });
};
