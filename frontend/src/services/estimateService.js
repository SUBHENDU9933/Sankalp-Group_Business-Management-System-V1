import { supabase } from "@/lib/supabase";

/**
 * Build the URL to open the existing HTML estimator with required config.
 * The HTML reads ?u, ?k, ?lead_id, ?id from query params.
 */
export const buildEstimatorUrl = ({ leadId, estimateId } = {}) => {
  const u = encodeURIComponent(process.env.REACT_APP_SUPABASE_URL || "");
  const k = encodeURIComponent(process.env.REACT_APP_SUPABASE_ANON_KEY || "");
  const params = new URLSearchParams();
  params.set("u", decodeURIComponent(u));
  params.set("k", decodeURIComponent(k));
  if (leadId) params.set("lead_id", leadId);
  if (estimateId) params.set("id", estimateId);
  return `/estimator.html?${params.toString()}`;
};

export const fetchEstimates = async () => {
  const withFilter = await supabase
    .from("estimates")
    .select("*, creator:profiles!estimates_created_by_fkey(id,full_name,email), lead:leads!estimates_lead_id_fkey(id,name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!withFilter.error) return withFilter.data || [];
  const { data, error } = await supabase
    .from("estimates")
    .select("*, creator:profiles!estimates_created_by_fkey(id,full_name,email), lead:leads!estimates_lead_id_fkey(id,name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchEstimateById = async (id) => {
  const { data, error } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateEstimateStatus = async (id, status) => {
  const { error } = await supabase.from("estimates").update({ status }).eq("id", id);
  if (error) throw error;
};

export const deleteEstimate = async (id, userId) => {
  const { error } = await supabase.from("estimates")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

export const duplicateEstimate = async (estimate, userId) => {
  // Get a fresh estimate_no via RPC
  const { data: newNo, error: noErr } = await supabase.rpc("next_estimate_no");
  if (noErr) throw noErr;
  const payload = {
    estimate_no: newNo,
    lead_id: estimate.lead_id || null,
    customer_name: estimate.customer_name,
    phone: estimate.phone,
    data: { ...(estimate.data || {}), meta: { ...((estimate.data || {}).meta || {}), estNo: newNo } },
    final_amount: estimate.final_amount,
    status: "draft",
    created_by: userId,
  };
  const { data, error } = await supabase.from("estimates").insert([payload]).select("*").single();
  if (error) throw error;
  return data;
};
