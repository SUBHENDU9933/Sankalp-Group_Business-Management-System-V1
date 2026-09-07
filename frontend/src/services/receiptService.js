import { supabase } from "@/lib/supabase";
import { pushToAllAdmins } from "@/services/notificationService";

const RECEIPT_ACTIONS = Object.freeze({
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
});

const normalizeReceiptRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "rm" || value === "manager") return "rm";
  if (value === "re" || value === "executive") return "re";
  return value;
};

const assertReceiptPermission = async (action) => {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const role = profile?.is_admin ? "admin" : normalizeReceiptRole(profile?.role);
  const allowed =
    role === "admin" ||
    (role === "rm" && [RECEIPT_ACTIONS.CREATE, RECEIPT_ACTIONS.EDIT].includes(action)) ||
    (role === "re" && action === RECEIPT_ACTIONS.CREATE);

  if (!allowed) throw new Error(`You do not have permission to ${action} receipts.`);
};

export const fetchReceipts = async () => {
  const rich = "*, customer:customers(id,name,phone,address), lead:leads(id,name,phone), requested_by:profiles!receipts_delete_requested_by_fkey(id,full_name,email)";
  const withFilter = await supabase
    .from("receipts")
    .select(rich)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!withFilter.error) return withFilter.data || [];
  // Fallback if v14/v16 not yet applied
  const { data, error } = await supabase
    .from("receipts")
    .select("*, customer:customers(id,name,phone,address)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

// Direct update (scope and ownership remain enforced by RLS)
export const updateReceipt = async (id, payload) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.EDIT);
  const { data, error } = await supabase
    .from("receipts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

// RM/user requests admin to delete; destructive authorization remains server-side.
export const requestDeleteReceipt = async (id) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.DELETE);
  const { error } = await supabase.rpc("request_delete_receipt", { p_id: id });
  if (error) throw error;
  const { data: r } = await supabase.from("receipts").select("receipt_no,amount").eq("id", id).maybeSingle();
  await pushToAllAdmins({
    type: "delete_request",
    title: `Receipt delete request: ${r?.receipt_no || ""}`,
    body: "Awaiting your approval in /approvals",
    link: "/approvals",
  });
};

export const cancelDeleteReceipt = async (id) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.DELETE);
  const { error } = await supabase.rpc("cancel_delete_receipt", { p_id: id });
  if (error) throw error;
};

// Admin approves the delete request — soft-delete to Trash
export const adminDeleteReceipt = async (id, userId) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.DELETE);
  const { error } = await supabase.from("receipts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, delete_request: false })
    .eq("id", id);
  if (error) throw error;
};

// (kept for backward-compat callers)
export const deleteReceipt = adminDeleteReceipt;

// ---------- Receipt Attachments (v14+) ----------
export const fetchReceiptAttachments = async (receiptId) => {
  const { data, error } = await supabase
    .from("receipt_attachments")
    .select("*, uploader:profiles!receipt_attachments_uploaded_by_fkey(full_name,email)")
    .eq("receipt_id", receiptId)
    .order("uploaded_at", { ascending: true });
  if (error) {
    if (/receipt_attachments|does not exist/i.test(error.message)) return [];
    throw error;
  }
  return data || [];
};

// Public (anon) variant used by /verify/:uid
export const fetchReceiptAttachmentsPublic = async (receiptId) => {
  const { data, error } = await supabase.rpc("get_receipt_attachments_by_receipt", { p_receipt_id: receiptId });
  if (error) return [];
  return data || [];
};

export const addReceiptAttachment = async ({ receiptId, url, name, type, size, userId }) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.CREATE);
  const { data, error } = await supabase
    .from("receipt_attachments")
    .insert([{ receipt_id: receiptId, file_url: url, file_name: name, file_type: type, size_bytes: size, uploaded_by: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeReceiptAttachment = async (id) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.DELETE);
  const { error } = await supabase.from("receipt_attachments").delete().eq("id", id);
  if (error) throw error;
};

export const fetchReceiptsByCustomer = async (customerId) => {
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchReceiptById = async (id) => {
  const { data, error } = await supabase
    .from("receipts")
    .select("*, customer:customers(id,name,phone,address,project_details), lead:leads(id,name,phone,location), project:projects(id,project_name), creator:profiles!receipts_created_by_fkey(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createReceipt = async (payload, userId) => {
  await assertReceiptPermission(RECEIPT_ACTIONS.CREATE);
  const { data, error } = await supabase
    .from("receipts")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
