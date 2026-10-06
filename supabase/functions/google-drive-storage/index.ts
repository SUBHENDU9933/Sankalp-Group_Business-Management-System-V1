import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const bytes = (s: string) => Uint8Array.from(
  atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4)),
  (c) => c.charCodeAt(0),
);

const key = async () => {
  const raw = Deno.env.get("GOOGLE_OAUTH_ENCRYPTION_KEY");
  if (!raw) throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY is not configured");
  let b: Uint8Array;
  try { b = bytes(raw); } catch { b = new TextEncoder().encode(raw); }
  if (b.length !== 32) throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", b, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

const decrypt = async (value: string) => {
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("Invalid encrypted Google token");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(parts[0]) },
    await key(),
    bytes(parts[1]),
  );
  return new TextDecoder().decode(plain);
};

const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const userDb = (token: string) => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + token } },
  },
);

async function drive(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch("https://www.googleapis.com/drive/v3" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Google Drive request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

async function driveWithRefresh(
  db: any,
  connection: any,
  path: string,
  init: RequestInit = {},
) {
  let accessToken = await decrypt(connection.access_token_encrypted);
  try {
    return { data: await drive(path, accessToken, init), connection, accessToken };
  } catch (error) {
    const status = Number((error as Error & { status?: number }).status || 0);
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 401 && !/invalid credentials|unauthorized|401/i.test(message)) throw error;

    const refreshed = await refresh(db, connection);
    accessToken = await decrypt(refreshed.access_token_encrypted);
    return { data: await drive(path, accessToken, init), connection: refreshed, accessToken };
  }
}

async function refresh(connectionDb: any, connection: any) {
  const refreshToken = await decrypt(connection.refresh_token_encrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token?.error_description || "Google token refresh failed");

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = b64(iv) + "." + b64(new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(token.access_token),
  )));

  const patch = {
    access_token_encrypted: encrypted,
    token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    status: "connected",
    last_error: null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await connectionDb.from("google_drive_connections").update(patch).eq("id", connection.id);
  return { ...connection, ...patch };
}

const folderName = (name: string, phone: string) =>
  String(name || "Lead").trim() + " - " + (String(phone || "").replace(/D/g, "").slice(-5) || "unknown");

const escapeDriveQuery = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

async function getConnection(db: any) {
  const { data, error } = await db.from("google_drive_connections").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "connected") {
    throw new Error("Google Drive is not connected. Ask Admin to connect it.");
  }

  // Google can invalidate an access token before the stored expiry timestamp.
  // Validate the current token once and transparently refresh on a 401.
  try {
    const accessToken = await decrypt(data.access_token_encrypted);
    await drive("/about?fields=user", accessToken);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/invalid credentials|unauthorized|401/i.test(message)) throw error;

    try {
      return await refresh(db, data);
    } catch (refreshError) {
      const refreshMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
      await db.from("google_drive_connections").update({
        status: "error",
        last_error: refreshMessage,
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
      throw new Error("Google Drive authorization has expired or was revoked. Admin must reconnect Google Drive.");
    }
  }
}

async function getLeadAccess(db: any, token: string, leadId: string) {
  const { data, error } = await userDb(token)
    .from("leads")
    .select("id,name,phone")
    .eq("id", leadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead not found or access denied");
  return data;
}

async function getBmsRoot(db: any, connection: any) {
  if (!connection.root_folder_id) throw new Error("Google Drive root folder is not configured");
  const rootQuery =
    "name='SANKALP BMS' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" +
    escapeDriveQuery(connection.root_folder_id) +
    "' in parents";
  const result = await driveWithRefresh(
    db,
    connection,
    "/files?q=" + encodeURIComponent(rootQuery) + "&pageSize=10&fields=files(id)",
  );
  if (result.data.files?.[0]?.id) return result.data.files[0].id;
  const created = await driveWithRefresh(db, result.connection, "/files?fields=id", {
    method: "POST",
    body: JSON.stringify({
      name: "SANKALP BMS",
      mimeType: "application/vnd.google-apps.folder",
      parents: [result.connection.root_folder_id],
    }),
  });
  return created.data.id;
}

async function ensureLeadFolder(db: any, token: string, leadId: string, bmsRoot: string) {
  const { data: lead, error } = await db
    .from("leads")
    .select("id,name,phone,drive_folder_id")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found");

  if (lead.drive_folder_id) {
    try {
      const existing = await drive(
        "/files/" + encodeURIComponent(lead.drive_folder_id) + "?fields=id,name,mimeType,trashed,parents",
        token,
      );
      if (
        existing.id === lead.drive_folder_id &&
        existing.mimeType === "application/vnd.google-apps.folder" &&
        existing.trashed === false
      ) return existing.id;
    } catch (_) {
      // The stored folder reference is stale; recreate/re-resolve it below.
    }
  }

  const leadsRootQuery =
    "name='LEADS' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" +
    escapeDriveQuery(bmsRoot) +
    "' in parents";
  const leadsRootResult = await drive(
    "/files?q=" + encodeURIComponent(leadsRootQuery) + "&pageSize=10&fields=files(id)",
    token,
  );
  const leadsRoot = leadsRootResult.files?.[0]?.id || (await drive("/files?fields=id", token, {
    method: "POST",
    body: JSON.stringify({
      name: "LEADS",
      mimeType: "application/vnd.google-apps.folder",
      parents: [bmsRoot],
    }),
  })).id;

  const name = folderName(lead.name, lead.phone);
  const folderQuery =
    "name='" + escapeDriveQuery(name) +
    "' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" +
    escapeDriveQuery(leadsRoot) + "' in parents";
  const existing = await drive(
    "/files?q=" + encodeURIComponent(folderQuery) + "&pageSize=10&fields=files(id)",
    token,
  );
  const folderId = existing.files?.[0]?.id || (await drive("/files?fields=id,name", token, {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [leadsRoot],
    }),
  })).id;

  await db.from("leads").update({ drive_folder_id: folderId }).eq("id", leadId);
  return folderId;
}

async function getLeadContext(db: any, token: string, leadId: string) {
  const lead = await getLeadAccess(db, token, leadId);
  let connection = await getConnection(db);

  // getBmsRoot() can transparently refresh an invalid Drive access token.
  // Re-read the connection afterwards so register/preview/download use the
  // refreshed token rather than the stale token that was loaded before root lookup.
  const bmsRoot = await getBmsRoot(db, connection);
  connection = await getConnection(db);
  const accessToken = await decrypt(connection.access_token_encrypted);

  const leadFolderId = await ensureLeadFolder(db, accessToken, leadId, bmsRoot);
  return { lead, connection, accessToken, bmsRoot, leadFolderId };
}

async function verifyDriveFileForLead(accessToken: string, driveFileId: string, leadFolderId: string) {
  const file = await drive(
    "/files/" + encodeURIComponent(driveFileId) +
      "?fields=id,name,mimeType,size,webViewLink,parents,trashed",
    accessToken,
  );
  if (!file.id || file.trashed || !Array.isArray(file.parents) || !file.parents.includes(leadFolderId)) {
    throw new Error("Drive file does not belong to the selected Lead folder");
  }
  return file;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const db = admin();
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Authentication required" }, 401);

    const { data: authUser, error: authError } = await db.auth.getUser(bearer);
    if (authError || !authUser.user) return json({ error: "Invalid or expired session" }, 401);

    const isJson = req.headers.get("content-type")?.includes("application/json");
    const body: any = isJson ? await req.json() : await req.formData();
    const get = (key: string) => isJson ? body[key] : body.get(key);

    const action = String(get("action") || "");
    const leadId = String(get("lead_id") || "");
    const fileId = String(get("file_id") || "");
    const fileName = String(get("file_name") || "");
    const mimeType = String(get("mime_type") || "application/octet-stream");
    const size = Number(get("size") || 0);
    const category = String(get("category") || "other");
    const driveFileId = String(get("drive_file_id") || "");
    const driveUrl = String(get("drive_url") || "");
    const driveParentId = String(get("drive_parent_id") || "");

    if (!action) return json({ error: "Action is required" }, 400);
    if (["start_upload", "list", "register"].includes(action) && !leadId) {
      return json({ error: "Lead reference is required" }, 400);
    }

    if (action === "list") {
      const lead = await getLeadAccess(db, bearer, leadId);
      const { data, error } = await userDb(bearer)
        .from("bms_files")
        .select("id,scope_type,lead_id,file_name,file_type,file_size,category,source,storage_provider,drive_file_id,drive_url,drive_parent_id,uploaded_by,uploaded_at,deleted_at")
        .eq("scope_type", "lead")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw new Error(error.message);
      return json({ files: data || [] });
    }

    if (action === "start_upload") {
      if (!fileName || size < 1) return json({ error: "File metadata is required" }, 400);
      let connection = await getConnection(db);
      let accessToken = await decrypt(connection.access_token_encrypted);
      const bmsRoot = await getBmsRoot(db, connection);
      connection = (await getConnection(db));
      accessToken = await decrypt(connection.access_token_encrypted);
      const leadFolderId = await ensureLeadFolder(db, accessToken, leadId, bmsRoot);

      const createUploadSession = async (token: string) => fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,parents",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": String(size),
          },
          body: JSON.stringify({ name: fileName, mimeType, parents: [leadFolderId] }),
        },
      );

      let response = await createUploadSession(accessToken);
      if (response.status === 401) {
        connection = await refresh(db, connection);
        accessToken = await decrypt(connection.access_token_encrypted);
        response = await createUploadSession(accessToken);
      }
      if (!response.ok) throw new Error(await response.text());
      const sessionUrl = response.headers.get("Location");
      if (!sessionUrl) throw new Error("Google Drive did not return an upload session");

      return json({
        session_url: sessionUrl,
        parent_folder_id: leadFolderId,
        provider: "google_drive",
      });
    }

    if (action === "register") {
      if (!driveFileId || size < 1 || !fileName) return json({ error: "Drive file metadata is required" }, 400);
      const { accessToken, leadFolderId } = await getLeadContext(db, bearer, leadId);
      const file = await verifyDriveFileForLead(accessToken, driveFileId, leadFolderId);

      const { data: existing, error: existingError } = await db
        .from("bms_files")
        .select("*")
        .eq("drive_file_id", driveFileId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing && existing.deleted_at === null) {
        return json({ provider: "google_drive", ...existing, bms_file_id: existing.id });
      }

      const metadata = {
        scope_type: "lead",
        lead_id: leadId,
        file_name: file.name || fileName,
        file_type: file.mimeType || mimeType,
        file_size: Number(file.size || size),
        category,
        source: "lead",
        storage_provider: "google_drive",
        drive_file_id: driveFileId,
        drive_url: file.webViewLink || driveUrl || ("https://drive.google.com/open?id=" + driveFileId),
        drive_parent_id: file.parents?.[0] || driveParentId || leadFolderId,
        uploaded_by: authUser.user.id,
      };

      const { data, error } = await db.from("bms_files").insert([metadata]).select("*").single();
      if (error) throw new Error("Drive upload succeeded, but BMS file registration failed: " + error.message);
      return json({ provider: "google_drive", ...data, bms_file_id: data.id });
    }

    if (action === "download" || action === "preview") {
      if (!fileId) return json({ error: "BMS file reference is missing" }, 400);
      const { data: file, error } = await userDb(bearer)
        .from("bms_files")
        .select("id,file_name,file_type,drive_file_id,lead_id")
        .eq("id", fileId)
        .eq("scope_type", "lead")
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!file?.drive_file_id) return json({ error: "File not found or access denied" }, 404);

      const { accessToken } = await getLeadContext(db, bearer, file.lead_id);
      const driveResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.drive_file_id) + "?alt=media",
        { headers: { Authorization: "Bearer " + accessToken } },
      );
      if (!driveResponse.ok) throw new Error(await driveResponse.text());

      return new Response(driveResponse.body, {
        status: 200,
        headers: {
          "Content-Type": file.file_type || driveResponse.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition":
            (action === "preview" ? "inline" : "attachment") +
            '; filename="' + String(file.file_name || "file").replaceAll('"', "") + '"',
          ...CORS,
        },
      });
    }

    if (action === "delete") {
      if (!fileId) return json({ error: "BMS file reference is missing" }, 400);

      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role,is_active")
        .eq("id", authUser.user.id)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile || String(profile.role || "").toLowerCase() !== "admin" || profile.is_active === false) {
        return json({ error: "Admin access required" }, 403);
      }

      const { data: file, error: fileError } = await db
        .from("bms_files")
        .select("id,lead_id,drive_file_id")
        .eq("id", fileId)
        .eq("scope_type", "lead")
        .is("deleted_at", null)
        .maybeSingle();
      if (fileError) throw new Error(fileError.message);
      if (!file) return json({ error: "File not found" }, 404);

      const connection = await getConnection(db);
      const accessToken = await decrypt(connection.access_token_encrypted);
      const driveResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.drive_file_id),
        {
          method: "PATCH",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        },
      );
      if (!driveResponse.ok && driveResponse.status !== 404) {
        throw new Error(await driveResponse.text());
      }

      const { error } = await db
        .from("bms_files")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", fileId)
        .is("deleted_at", null);
      if (error) throw new Error("Drive file was removed, but BMS record could not be marked deleted: " + error.message);

      return json({ success: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("google-drive-storage error", error);
    return json({ error: error instanceof Error ? error.message : "Google Drive storage failed" }, 500);
  }
});
