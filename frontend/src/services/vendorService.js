import { supabase } from "@/lib/supabase";

const VENDOR_FIELDS =
  "id,name,type,phone,email,address,gst_no,pan_no,aadhar_no,upi_id,account_holder,account_no,ifsc,bank_name,photo_url,id_card_url,visiting_card_url,notes,is_active,created_at,updated_at,created_by";

const VENDOR_DIRECTORY_FIELDS =
  "id,name,type,phone,email,address,is_active,created_at,updated_at,created_by";

/**
 * Full vendor data is now restricted by RLS to Admins and the vendor creator.
 * The directory view contains only non-KYC fields and is available to all
 * authenticated users for operational vendor lookup.
 */
const tryFullElseBase = async (action) => {
  try {
    return await action(VENDOR_FIELDS);
  } catch (e) {
    if ((e?.message || "").match(/column .* does not exist/i)) {
      return await action("*");
    }
    throw e;
  }
};

export const fetchVendors = async () => {
  const { data, error } = await supabase
    .from("vendor_directory")
    .select(VENDOR_DIRECTORY_FIELDS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchVendorById = async (id) => {
  const full = await tryFullElseBase(async (sel) => {
    const { data, error } = await supabase
      .from("vendors")
      .select(sel + ",creator:profiles!vendors_created_by_fkey(id,full_name,email)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
  if (full) return full;

  const { data, error } = await supabase
    .from("vendor_directory")
    .select(VENDOR_DIRECTORY_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createVendor = async (payload, userId) => {
  const { data, error } = await supabase
    .from("vendors")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateVendor = async (id, payload) => {
  const { data, error } = await supabase
    .from("vendors")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteVendor = async (id, userId) => {
  const { error } = await supabase.from("vendors")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

/**
 * Upload a vendor doc (photo / id_card / visiting_card) to the public 'vendor-docs' bucket.
 * Path: {vendorId}/{kind}.{ext}. Persists the public URL on the vendor row.
 */
export const uploadVendorDoc = async (vendorId, kind, file) => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${vendorId}/${kind}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("vendor-docs")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("vendor-docs").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  const fieldMap = { photo: "photo_url", id_card: "id_card_url", visiting_card: "visiting_card_url" };
  const field = fieldMap[kind];
  if (field) {
    const { error: updErr } = await supabase.from("vendors").update({ [field]: url }).eq("id", vendorId);
    if (updErr) throw updErr;
  }
  return url;
};

// ---------- VENDOR PAYMENTS ----------
export const fetchVendorPayments = async (vendorId) => {
  let q = supabase
    .from("vendor_payments")
    .select("*, project:projects(id,project_name), bill:vendor_bills(id,title,amount)")
    .order("payment_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const withFilter = await q.is("deleted_at", null);
  if (withFilter.error) throw withFilter.error;
  const rows = withFilter.data || [];
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))];
  if (!vendorIds.length) return rows;
  const { data: vendors, error: vendorError } = await supabase
    .from("vendor_directory")
    .select("id,name,type,phone")
    .in("id", vendorIds);
  if (vendorError) throw vendorError;
  const byId = new Map((vendors || []).map((v) => [v.id, v]));
  return rows.map((r) => ({ ...r, vendor: byId.get(r.vendor_id) || null }));
};

export const createVendorPayment = async (payload, userId) => {
  const { data, error } = await supabase
    .from("vendor_payments")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteVendorPayment = async (id, userId) => {
  const { error } = await supabase.from("vendor_payments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

// ---------- VENDOR WORK / BILLS ----------
export const fetchVendorBills = async (vendorId) => {
  let q = supabase
    .from("vendor_bills")
    .select("*, project:projects(id,project_name)")
    .is("deleted_at", null)
    .order("bill_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))];
  if (!vendorIds.length) return rows;
  const { data: vendors, error: vendorError } = await supabase
    .from("vendor_directory")
    .select("id,name,type")
    .in("id", vendorIds);
  if (vendorError) throw vendorError;
  const byId = new Map((vendors || []).map((v) => [v.id, v]));
  return rows.map((r) => ({ ...r, vendor: byId.get(r.vendor_id) || null }));
};

export const createVendorBill = async (payload, userId) => {
  const { data, error } = await supabase
    .from("vendor_bills")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteVendorBill = async (id, userId) => {
  const { error } = await supabase.from("vendor_bills")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};
