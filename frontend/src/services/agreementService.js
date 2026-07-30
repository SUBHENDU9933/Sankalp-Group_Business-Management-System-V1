import { supabase } from "@/lib/supabase";
import { pushToAllAdmins } from "@/services/notificationService";

export const fetchAgreements = async () => {
  const { data, error } = await supabase
    .from("agreements")
    .select(
      "*, creator:profiles!agreements_created_by_fkey(id,full_name,email), customer:customers!agreements_customer_id_fkey(id,name,phone), project:projects!agreements_project_id_fkey(id,project_name), template:agreement_templates!agreements_template_id_fkey(id,name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchAgreementById = async (id) => {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createAgreement = async (payload, userId) => {
  const { data, error } = await supabase
    .from("agreements")
    .insert([{ ...payload, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateAgreement = async (id, payload) => {
  const { data, error } = await supabase
    .from("agreements")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const softDeleteAgreement = async (id, userId) => {
  const { error } = await supabase
    .from("agreements")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};

// Mark an agreement as sent-for-digital-signature: generates a magic-link token.
// `snapshot` (optional) is the fully-resolved [{title, body}] clause list — frozen
// at send-time so the public /sign/:token page never needs authenticated template access.
export const sendForDigitalSignature = async (id, { expiryDays = 7, snapshot } = {}) => {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expires_at = new Date(Date.now() + expiryDays * 86400000).toISOString();
  const patch = { status: "sent", signing_mode: "digital", token, expires_at };
  if (snapshot) patch.signed_snapshot = snapshot;
  const { data, error } = await supabase
    .from("agreements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

// Mark as physically signed + attach the uploaded scanned copy URL
export const markSignedPhysical = async (id, signedFileUrl) => {
  const { data, error } = await supabase
    .from("agreements")
    .update({ status: "signed_physical", signing_mode: "physical", signed_file_url: signedFileUrl, signed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const voidAgreement = async (id) => {
  const { error } = await supabase.from("agreements").update({ status: "void" }).eq("id", id);
  if (error) throw error;
};

// -------- Merge-field builder --------
// Pulls whatever is available from a customer/lead/project/estimate row into
// the flat merge_data object used by the clause placeholder engine.
export const buildMergeDataFromSources = ({ customer, lead, project, estimate }) => {
  const md = {};
  const person = customer || lead;
  if (person) {
    md.client_name = person.name || "";
    md.client_mobile = person.phone || "";
    md.client_address = person.address || "";
  }
  if (project) {
    md.project_type = project.project_name || "";
    md.project_location = project.location || "";
    md.contract_value = project.total_value || estimate?.final_amount || "";
  }
  if (estimate) {
    md.estimate_no = estimate.estimate_no || "";
    md.estimate_date = estimate.created_at ? new Date(estimate.created_at).toLocaleDateString("en-IN") : "";
    md.estimate_validity = "30 days";
    if (!md.contract_value) md.contract_value = estimate.final_amount || "";
    if (!md.project_type) md.project_type = "Interior Project";
  }
  md.category = md.category || "Standard";
  md.timeline_days = md.timeline_days || "60";
  md.buffer_days = md.buffer_days || "15";
  md.scope_items = md.scope_items || "";
  md.promotional_gift = md.promotional_gift || "";
  return md;
};

// Renders one clause body's {{placeholders}} against merge_data + computed tables
export const renderClauseBody = (body, merge_data = {}, { paymentSchedule = [], categorySpecs = {} } = {}) => {
  if (!body) return "";
  let out = body;
  Object.entries(merge_data).forEach(([k, v]) => {
    out = out.replaceAll(`{{${k}}}`, v ?? "");
  });
  out = out.replaceAll("{{contract_value_words}}", merge_data.contract_value_words || "");
  if (out.includes("{{payment_schedule_table}}")) {
    const rows = (paymentSchedule || [])
      .map((s) => `${s.stage}: ${s.percent}%`)
      .join(" · ");
    out = out.replaceAll("{{payment_schedule_table}}", rows ? `Schedule — ${rows}.` : "");
  }
  if (out.includes("{{category_specs_table}}")) {
    const key = (merge_data.category || "standard").toLowerCase();
    const lines = categorySpecs?.[key] || [];
    out = out.replaceAll("{{category_specs_table}}", lines.length ? lines.join("; ") + "." : "");
  }
  return out;
};

// -------- Public (magic-link) API — no auth --------
export const fetchAgreementByToken = async (token) => {
  const { data: base } = await supabase.rpc("get_agreement_by_token", { p_token: token });
  const row = Array.isArray(base) ? base[0] : base;
  return row || null;
};

export const submitAgreementSignature = async ({ token, signerName, signatureUrl, lat, lng, ip, userAgent }) => {
  const { data, error } = await supabase.rpc("submit_agreement_signature", {
    p_token: token,
    p_signer_name: signerName,
    p_signature_url: signatureUrl || null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_ip: ip || null,
    p_user_agent: userAgent || null,
  });
  if (error) throw error;
  return data;
};

export const uploadPublicSignaturePhoto = async (blob) => {
  const path = `agreements/signatures/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await supabase.storage.from("attachments").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, path };
};

export const notifyAdminsAgreementSigned = async ({ agreementId, customerName }) => {
  await pushToAllAdmins({
    title: "Agreement signed",
    body: `${customerName || "A client"} digitally signed their agreement.`,
    link: `/agreements`,
    type: "success",
  }).catch(() => {});
};
