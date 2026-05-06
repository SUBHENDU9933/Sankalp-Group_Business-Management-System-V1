// supabase/functions/sync-website-lead/index.ts
// =====================================================================
// SANKALP Website → BM App Lead Sync
// Deployed to BM App's Supabase as an Edge Function.
// Triggered by the Website Supabase DB Webhook on INSERT into leads.
//
// Secrets required (Supabase Edge Function secrets):
//   SUPABASE_URL            — BM app URL (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY — BM app service-role key (auto-provided)
//   WEBSITE_SYNC_SECRET     — your shared secret (set this one manually)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBSITE_SYNC_SECRET = Deno.env.get("WEBSITE_SYNC_SECRET")!;

// Convert website budget band ("₹12–20 Lakhs") to a numeric midpoint
function parseBudget(b: string | null): number | null {
  if (!b) return null;
  const s = String(b).toLowerCase().replace(/[₹, ]/g, "");
  if (s.includes("under")) {
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) * 100000 : null;
  }
  const range = s.match(/(\d+)[-–](\d+)/);
  if (range) {
    const avg = (Number(range[1]) + Number(range[2])) / 2;
    return avg * 100000;
  }
  const single = s.match(/(\d+)/);
  return single ? Number(single[1]) * 100000 : null;
}

// Convert website property_type ("2BHK Flat") to BM project_type ("2BHK")
function parseProjectType(pt: string | null): string | null {
  if (!pt) return null;
  const m = pt.match(/\d+BHK|Villa|Shop|Office|Showroom/i);
  return m ? m[0].toUpperCase() : pt;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ---- Auth: shared secret ----
  const secret = req.headers.get("x-sync-secret");
  if (!secret || secret !== WEBSITE_SYNC_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // ---- Parse webhook payload ----
  // Supabase DB webhooks send: { type: "INSERT", table: "leads", record: {...} }
  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
  const record = payload?.record || payload;
  if (!record?.name && !record?.phone) {
    return jsonResponse({ error: "Missing name and phone" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ---- Dedupe check: prior lead with same phone? ----
  const phone = (record.phone || "").trim();
  let isRepeat = false;
  let priorDate: string | null = null;
  if (phone) {
    const { data: existing } = await sb
      .from("leads")
      .select("id, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(1);
    if (existing && existing.length > 0) {
      isRepeat = true;
      priorDate = existing[0].created_at;
    }
  }

  // ---- Map website → BM ----
  const originalPageSrc = record.source || "website";
  const budgetStr = record.budget || "";
  const reminderParts: string[] = [];
  if (record.email) reminderParts.push(`✉ ${record.email}`);
  if (budgetStr) reminderParts.push(`Budget band: ${budgetStr}`);
  reminderParts.push(`Page: ${originalPageSrc}`);
  if (isRepeat && priorDate) {
    reminderParts.unshift(`🔁 REPEAT ENQUIRY · prior lead on ${new Date(priorDate).toISOString().slice(0, 10)}`);
  }

  const leadRow = {
    name: (record.name || "(Unnamed)").trim(),
    phone: phone || null,
    location: record.location || null,
    project_type: parseProjectType(record.property_type),
    property_type: record.property_type || null,
    budget: parseBudget(budgetStr),
    requirement: record.message || null,
    source: "Website",
    status: "new",
    priority: isRepeat ? "hot" : null,
    assigned_to: null,                             // ← unassigned, any RM picks up
    tag: isRepeat ? "Website · Repeat" : "Website Direct Enquiry",
    reminder_note: reminderParts.join(" · "),
    created_at: record.created_at || new Date().toISOString(),
  };

  const { data, error } = await sb.from("leads").insert([leadRow]).select("id").single();
  if (error) {
    console.error("Insert failed:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ inserted: true, id: data.id, is_repeat: isRepeat, tag: leadRow.tag }, 201);
});
