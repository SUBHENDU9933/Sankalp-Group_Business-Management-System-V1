import { supabase } from "@/lib/supabase";

const V2_SELECT = "*, creator:profiles!estimates_v2_created_by_fkey(id,full_name,email), lead:leads!estimates_v2_lead_id_fkey(id,name,assigned_to,assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email,role))";

export const buildEstimatorV1Url = ({ leadId, estimateId } = {}) => {
  const u = encodeURIComponent(process.env.REACT_APP_SUPABASE_URL || "");
  const k = encodeURIComponent(process.env.REACT_APP_SUPABASE_ANON_KEY || "");
  const params = new URLSearchParams();
  params.set("u", decodeURIComponent(u));
  params.set("k", decodeURIComponent(k));
  if (leadId) params.set("lead_id", leadId);
  if (estimateId) params.set("id", estimateId);
  return `/estimator.html?${params.toString()}`;
};

export const buildEstimatorV2Url = ({ leadId, estimateId } = {}) => {
  const u = encodeURIComponent(process.env.REACT_APP_SUPABASE_URL || "");
  const k = encodeURIComponent(process.env.REACT_APP_SUPABASE_ANON_KEY || "");
  const params = new URLSearchParams();
  params.set("u", decodeURIComponent(u));
  params.set("k", decodeURIComponent(k));
  if (leadId) params.set("lead_id", leadId);
  if (estimateId) params.set("id", estimateId);
  return `/estimator-v2.html?${params.toString()}`;
};

export const buildEstimatorUrl = ({ leadId, estimateId, version = 1, module } = {}) => {
  const resolvedVersion = Number(version || 1);
  if (resolvedVersion === 2 || module === "estimate_v2") return buildEstimatorV2Url({ leadId, estimateId });
  return buildEstimatorV1Url({ leadId, estimateId });
};

const normalizeV2 = (r) => ({ ...r, estimator_version: 2, estimator_module: "estimate_v2" });

export const fetchEstimates = async () => {
  const select = "*, creator:profiles!estimates_created_by_fkey(id,full_name,email), lead:leads!estimates_lead_id_fkey(id,name,assigned_to,assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email,role))";
  const [v1Result, v2Result] = await Promise.all([
    supabase.from("estimates").select(select).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("estimates_v2").select(V2_SELECT).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  if (v1Result.error) throw v1Result.error;
  if (v2Result.error) throw v2Result.error;
  return [...(v1Result.data || []), ...(v2Result.data || []).map(normalizeV2)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const fetchEstimateById = async (id, version) => {
  if (Number(version) === 2) {
    const { data, error } = await supabase.from("estimates_v2").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalizeV2(data) : null;
  }
  const { data, error } = await supabase.from("estimates").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: v2, error: v2Error } = await supabase.from("estimates_v2").select("*").eq("id", id).maybeSingle();
  if (v2Error) throw v2Error;
  return v2 ? normalizeV2(v2) : null;
};

export const updateEstimateStatus = async (id, status, version = 1) => {
  const table = Number(version) === 2 ? "estimates_v2" : "estimates";
  const { error } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const deleteEstimate = async (id, userId, version = 1) => {
  const table = Number(version) === 2 ? "estimates_v2" : "estimates";
  const { error } = await supabase.from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const duplicateEstimate = async (estimate, userId) => {
  const { data: newNo, error: noErr } = await supabase.rpc("next_estimate_no");
  if (noErr) throw noErr;
  const isV2 = Number(estimate.estimator_version || 1) === 2 || estimate.estimator_module === "estimate_v2";
  const table = isV2 ? "estimates_v2" : "estimates";
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
  const { data, error } = await supabase.from(table).insert([payload]).select("*").single();
  if (error) throw error;
  return isV2 ? normalizeV2(data) : data;
};
