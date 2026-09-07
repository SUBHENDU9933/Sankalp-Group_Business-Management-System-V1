import { supabase } from "@/lib/supabase";

const ACTIONS = Object.freeze({ VIEW: "view", CREATE: "create", EDIT: "edit", DELETE: "delete", SEND: "send" });

const normalizeRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "rm" || value === "manager") return "rm";
  if (value === "re" || value === "executive") return "re";
  return value;
};

const assertPermission = async (action) => {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const role = profile?.is_admin ? "admin" : normalizeRole(profile?.role);
  const allowed = role === "admin"
    || (role === "rm" && [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.SEND].includes(action))
    || (role === "re" && action === ACTIONS.VIEW);
  if (!allowed) throw new Error(`You do not have permission to ${action} digital approvals.`);
};

// Fetches all approvals visible to the caller; final row-level scope is enforced by Supabase RLS.
export const fetchApprovals = async ({ status, search } = {}) => {
  await assertPermission(ACTIONS.VIEW);
  let q = supabase
    .from("digital_approvals")
    .select("*, creator:profiles!digital_approvals_created_by_fkey(id,full_name,email), customer:customers!digital_approvals_customer_id_fkey(id,name), project:projects!digital_approvals_project_id_fkey(id,project_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) =>
      [r.subject, r.description, r.customer_name, r.project_name, r.creator?.full_name, r.creator?.email]
        .filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }
  return rows;
};

export const createApproval = async (payload) => {
  await assertPermission(ACTIONS.CREATE);
  const { data, error } = await supabase.from("digital_approvals").insert(payload).select().single();
  if (error) throw error;
  return data;
};

// Only an unsigned (still "pending") approval may be edited — once the
// customer has responded (approved/rejected), the record is evidence and
// must stay exactly as it was when they signed it.
export const updateApproval = async (id, payload) => {
  await assertPermission(ACTIONS.EDIT);
  const { data, error } = await supabase
    .from("digital_approvals")
    .update(payload)
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error("This approval has already been signed and can no longer be edited.");
  return data;
};

export const softDeleteApproval = async (id, userId) => {
  await assertPermission(ACTIONS.DELETE);
  const { data, error } = await supabase.from("digital_approvals")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This approval has already been signed and can no longer be deleted.");
};

// -------- Public (magic-link) API --------
export const fetchApprovalByToken = async (token) => {
  // Auto-expire if past due
  const { data: base } = await supabase.rpc("get_approval_by_token", { p_token: token });
  const row = Array.isArray(base) ? base[0] : base;
  if (!row) return null;
  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await supabase.rpc("mark_approval_expired_if_due", { p_id: row.id });
    row.status = "expired";
  }
  return row;
};

export const submitApprovalResponse = async ({
  token, status, name, comment, photoUrl, lat, lng, accuracy, ip, userAgent,
}) => {
  const { data, error } = await supabase.rpc("submit_approval_response", {
    p_token: token,
    p_status: status,
    p_name: name,
    p_comment: comment || null,
    p_photo_url: photoUrl || null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_accuracy: accuracy ?? null,
    p_ip: ip || null,
    p_user_agent: userAgent || null,
  });
  if (error) throw error;
  return data;
};

// Public storage upload (used by anon customer submitting selfie)
export const uploadPublicResponsePhoto = async (blob) => {
  const path = `approvals/responses/${Date.now()}-${crypto.randomUUID().slice(0,8)}.jpg`;
  const { error } = await supabase.storage.from("attachments").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, path };
};

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "expired"];
