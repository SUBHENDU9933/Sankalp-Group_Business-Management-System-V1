import { supabase } from "@/lib/supabase";

export const fetchLeadActivities = async (leadId) => {
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*, creator:profiles!lead_activities_created_by_fkey(id,full_name,email)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const addLeadActivity = async ({ leadId, type, content, meta, userId }) => {
  const { data, error } = await supabase
    .from("lead_activities")
    .insert([{ lead_id: leadId, type, content: content || null, meta: meta || null, created_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};


export const logLeadCallOutcome = async ({ leadId, outcome, userId, note }) => {
  if (!leadId || !["connected", "not_connected"].includes(outcome)) {
    throw new Error("Invalid call outcome");
  }

  // Call outcome is communication history, not the lead's lifecycle status.
  // A failed follow-up call must never move an already-contacted lead backwards.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,status")
    .eq("id", leadId)
    .single();
  if (leadError) throw leadError;

  const { count: previousCalls, error: countError } = await supabase
    .from("lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("type", "call");
  if (countError) throw countError;

  const attemptNumber = (previousCalls || 0) + 1;
  const currentStatus = lead.status;
  const isFirstCall = attemptNumber === 1;
  const firstCallStatus = outcome === "connected" ? "contacted" : "not_contacted";
  const shouldSetFirstCallStatus = isFirstCall && ["new", "not_contacted", "contacted"].includes(currentStatus);
  const resultingStatus = shouldSetFirstCallStatus ? firstCallStatus : currentStatus;

  if (shouldSetFirstCallStatus) {
    const statusPayload = { status: firstCallStatus };
    if (outcome === "connected") statusPayload.last_contact_date = new Date().toISOString().slice(0, 10);
    const { error: statusError } = await supabase
      .from("leads")
      .update(statusPayload)
      .eq("id", leadId);
    if (statusError) throw statusError;
  } else if (outcome === "connected") {
    // Preserve the existing lifecycle stage on every follow-up call, but refresh
    // the last successful contact date.
    const { error: contactError } = await supabase
      .from("leads")
      .update({ last_contact_date: new Date().toISOString().slice(0, 10) })
      .eq("id", leadId);
    if (contactError) throw contactError;
  }

  const outcomeLabel = outcome === "connected" ? "Connected" : "Not Connected";
  const content = note?.trim()
    ? `Call Attempt #${attemptNumber} — ${outcomeLabel} — ${note.trim()}`
    : `Call Attempt #${attemptNumber} — ${outcomeLabel}`;

  const { data, error } = await supabase
    .from("lead_activities")
    .insert([{
      lead_id: leadId,
      type: "call",
      content,
      meta: {
        outcome,
        attempt_number: attemptNumber,
        previous_status: currentStatus,
        resulting_status: resultingStatus,
        status_changed: firstContactPromotion,
        first_successful_contact: firstContactPromotion,
      },
      created_by: userId,
    }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
