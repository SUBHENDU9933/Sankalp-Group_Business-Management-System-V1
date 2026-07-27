import { supabase } from "@/lib/supabase";

const VENDOR_FIELDS =
  "id,name,type,phone,email,address,gst_no,pan_no,aadhar_no,upi_id,account_holder,account_no,ifsc,bank_name,photo_url,id_card_url,visiting_card_url,notes,is_active,created_at,updated_at,created_by";

/**
 * Try the new schema (with v9 columns); fall back to base columns on error.
 * Lets the UI work before/after the migration is applied.
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
  return tryFullElseBase(async (sel) => {
    let q = supabase
      .from("vendors")
      .select(sel)
      .order("created_at", { ascending: false });
    // Try with deleted_at filter first; fall back if column missing
    const withFilter = await q.is("deleted_at", null);
    if (!withFilter.error) return withFilter.data || [];
    const { data, error } = await supabase.from("vendors").select(sel).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });
};

export const fetchVendorById = async (id) => {
  return tryFullElseBase(async (sel) => {
    const { data, error } = await supabase
      .from("vendors")
      .select(sel + ",creator:profiles!vendors_created_by_fkey(id,full_name,email)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
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
    .select("*, vendor:vendors(id,name,type,phone), project:projects(id,project_name)")
    .order("payment_date", { ascending: false });
  if (vendorId) q = q.eq("vendor_id", vendorId);
  // Try with deleted_at filter first
  const withFilter = await q.is("deleted_at", null);
  if (!withFilter.error) return withFilter.data || [];
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
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
