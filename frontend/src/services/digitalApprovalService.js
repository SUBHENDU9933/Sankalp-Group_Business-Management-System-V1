import { supabase } from "@/lib/supabase";

// Fetches all approvals visible to the caller (admin sees all, RM sees own)
export const fetchApprovals = async ({ status, search } = {}) => {
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
  const { data, error } = await supabase.from("digital_approvals").insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const softDeleteApproval = async (id, userId) => {
  const { error } = await supabase.from("digital_approvals")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
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
