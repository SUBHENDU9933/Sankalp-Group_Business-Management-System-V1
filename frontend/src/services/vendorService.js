import { supabase } from "@/lib/supabase";

const VENDOR_FIELDS =
  "id,name,type,phone,email,address,gst_no,pan_no,aadhar_no,upi_id,account_holder,account_no,ifsc,bank_name,photo_url,id_card_url,visiting_card_url,notes,is_active,created_at,updated_at,created_by";
const VENDOR_DIRECTORY_FIELDS =
  "id,name,type,phone,email,address,is_active,created_at,updated_at,created_by";
const VENDOR_DOC_BUCKET = "vendor-docs";
const VENDOR_DOC_FIELDS = ["photo_url", "id_card_url", "visiting_card_url"];
const VENDOR_DOC_SIGNED_URL_TTL = 60 * 60;
const ACTIONS = Object.freeze({ CREATE: "create", EDIT: "edit", DELETE: "delete" });

const normalizeRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "rm" || value === "manager") return "rm";
  if (value === "re" || value === "executive") return "re";
  return value;
};

const getCurrentRole = async () => {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: profile, error } = await supabase.from("profiles").select("role,is_admin").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return profile?.is_admin ? "admin" : normalizeRole(profile?.role);
};

const assertPermission = async (resource, action) => {
  const role = await getCurrentRole();
  let allowed = role === "admin";
  if (resource === "vendors") allowed = role === "admin";
  if (resource === "vendor_payments") allowed = role === "admin" || (role === "rm" && [ACTIONS.CREATE, ACTIONS.EDIT].includes(action)) || (role === "re" && action === ACTIONS.CREATE);
  if (resource === "vendor_bills") allowed = role === "admin" || (role === "rm" && [ACTIONS.CREATE, ACTIONS.EDIT].includes(action)) || (role === "re" && action === ACTIONS.CREATE);
  if (!allowed) throw new Error(`You do not have permission to ${action} ${resource}.`);
};

const tryFullElseBase = async (action) => {
  try { return await action(VENDOR_FIELDS); }
  catch (e) {
    if ((e?.message || "").match(/column .* does not exist/i)) return await action("*");
    throw e;
  }
};

const extractVendorDocPath = (value) => {
  if (!value || typeof value !== "string") return null;
  const marker = `/storage/v1/object/public/${VENDOR_DOC_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return decodeURIComponent(value.slice(markerIndex + marker.length).split("?")[0]);
  return null;
};

const signVendorDocuments = async (vendor) => {
  if (!vendor) return vendor;
  const signed = { ...vendor };
  await Promise.all(VENDOR_DOC_FIELDS.map(async (field) => {
    const path = extractVendorDocPath(vendor[field]);
    if (!path) return;
    const { data, error } = await supabase.storage.from(VENDOR_DOC_BUCKET).createSignedUrl(path, VENDOR_DOC_SIGNED_URL_TTL);
    if (error) throw error;
    if (data?.signedUrl) signed[field] = data.signedUrl;
  }));
  return signed;
};

export const fetchVendors = async () => {
  const role = await getCurrentRole();
  if (role === "admin") {
    const { data, error } = await supabase.from("vendors").select(VENDOR_FIELDS).order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(signVendorDocuments));
  }
  const { data, error } = await supabase.from("vendor_directory").select(VENDOR_DIRECTORY_FIELDS).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchVendorById = async (id) => {
  const role = await getCurrentRole();
  if (role === "admin") {
    const full = await tryFullElseBase(async (sel) => {
      const { data, error } = await supabase.from("vendors").select(sel + ",creator:profiles!vendors_created_by_fkey(id,full_name,email)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    });
    if (full) return signVendorDocuments(full);
  }
  const { data, error } = await supabase.from("vendor_directory").select(VENDOR_DIRECTORY_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
};

export const createVendor = async (payload, userId) => {
  await assertPermission("vendors", ACTIONS.CREATE);
  const { data, error } = await supabase.from("vendors").insert([{ ...payload, created_by: userId }]).select("*").single();
  if (error) throw error;
  return data;
};

export const updateVendor = async (id, payload) => {
  await assertPermission("vendors", ACTIONS.EDIT);
  const { data, error } = await supabase.from("vendors").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return signVendorDocuments(data);
};

export const deleteVendor = async (id, userId) => {
  await assertPermission("vendors", ACTIONS.DELETE);
  const { error } = await supabase.from("vendors").update({ deleted_at: new Date().toISOString(), deleted_by: userId }).eq("id", id);
  if (error) throw error;
};

export const uploadVendorDoc = async (vendorId, kind, file) => {
  await assertPermission("vendors", ACTIONS.EDIT);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${vendorId}/${kind}.${ext}`;
  const { error: upErr } = await supabase.storage.from(VENDOR_DOC_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(VENDOR_DOC_BUCKET).getPublicUrl(path);
  const stableUrl = pub?.publicUrl || null;
  const fieldMap = { photo: "photo_url", id_card: "id_card_url", visiting_card: "visiting_card_url" };
  const field = fieldMap[kind];
  if (field) {
    const { error: updErr } = await supabase.from("vendors").update({ [field]: stableUrl }).eq("id", vendorId);
    if (updErr) throw updErr;
  }
  const { data: signed, error: signedErr } = await supabase.storage.from(VENDOR_DOC_BUCKET).createSignedUrl(path, VENDOR_DOC_SIGNED_URL_TTL);
  if (signedErr) throw signedErr;
  return signed?.signedUrl || stableUrl;
};

export const fetchVendorPayments = async (vendorId) => {
  let q = supabase.from("vendor_payments").select("*, project:projects(id,project_name), bill:vendor_bills(id,title,amount)").order("payment_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const withFilter = await q.is("deleted_at", null);
  if (withFilter.error) throw withFilter.error;
  const rows = withFilter.data || [];
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))];
  if (!vendorIds.length) return rows;
  const { data: vendors, error: vendorError } = await supabase.from("vendor_directory").select("id,name,type,phone").in("id", vendorIds);
  if (vendorError) throw vendorError;
  const byId = new Map((vendors || []).map((v) => [v.id, v]));
  return rows.map((r) => ({ ...r, vendor: byId.get(r.vendor_id) || null }));
};

export const createVendorPayment = async (payload, userId) => {
  await assertPermission("vendor_payments", ACTIONS.CREATE);
  const { data, error } = await supabase.from("vendor_payments").insert([{ ...payload, created_by: userId }]).select("*").single();
  if (error) throw error;
  return data;
};

export const deleteVendorPayment = async (id, userId) => {
  await assertPermission("vendor_payments", ACTIONS.DELETE);
  const { error } = await supabase.from("vendor_payments").update({ deleted_at: new Date().toISOString(), deleted_by: userId }).eq("id", id);
  if (error) throw error;
};

export const fetchVendorBills = async (vendorId) => {
  let q = supabase.from("vendor_bills").select("*, project:projects(id,project_name)").is("deleted_at", null).order("bill_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))];
  if (!vendorIds.length) return rows;
  const { data: vendors, error: vendorError } = await supabase.from("vendor_directory").select("id,name,type").in("id", vendorIds);
  if (vendorError) throw vendorError;
  const byId = new Map((vendors || []).map((v) => [v.id, v]));
  return rows.map((r) => ({ ...r, vendor: byId.get(r.vendor_id) || null }));
};

export const createVendorBill = async (payload, userId) => {
  await assertPermission("vendor_bills", ACTIONS.CREATE);
  const { data, error } = await supabase.from("vendor_bills").insert([{ ...payload, created_by: userId }]).select("*").single();
  if (error) throw error;
  return data;
};

export const deleteVendorBill = async (id, userId) => {
  await assertPermission("vendor_bills", ACTIONS.DELETE);
  const { error } = await supabase.from("vendor_bills").update({ deleted_at: new Date().toISOString(), deleted_by: userId }).eq("id", id);
  if (error) throw error;
};
