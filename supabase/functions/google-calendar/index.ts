import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "jsr:@panva/jose@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getSupabaseClients = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) throw new Error("Supabase server configuration is missing");
  return {
    authClient: createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }),
    adminClient: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
};

async function googleAccessToken(scopes: string[]) {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const subject = Deno.env.get("GOOGLE_WORKSPACE_IMPERSONATE_EMAIL");
  if (!raw || !subject) throw new Error("Google Calendar is not connected");
  const service = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(service.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: scopes.join(" "),
    sub: subject,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(service.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || "Google token request failed");
  return data.access_token as string;
}

async function googleFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || "Google Calendar request failed";
    throw new Error(message);
  }
  return data;
}

function overlaps(block: { start: string; end: string }, start: string, end: string) {
  return new Date(block.start).getTime() < new Date(end).getTime() &&
    new Date(block.end).getTime() > new Date(start).getTime();
}

function mergeBusy(calendarBusy: Record<string, { start: string; end: string }[]>) {
  return Object.values(calendarBusy).flat().sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  try {
    const { authClient, adminClient } = getSupabaseClients();
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid or expired session" }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "status");

    if (action === "status") {
      const configured = Boolean(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") && Deno.env.get("GOOGLE_WORKSPACE_IMPERSONATE_EMAIL"));
      const { data: master } = await adminClient
        .from("schedule_calendar_mappings")
        .select("calendar_email,calendar_id,enabled")
        .is("user_id", null)
        .eq("provider", "google")
        .eq("is_primary", true)
        .maybeSingle();
      return json({
        configured,
        master_calendar: master || null,
        message: configured ? "Google Calendar credentials are configured" : "Google Calendar connection is pending",
      });
    }

    if (action === "availability") {
      const start = String(payload.start || "");
      const end = String(payload.end || "");
      const userIds = [...new Set((payload.user_ids || []).filter(Boolean))];
      if (!start || !end || !userIds.length) return json({ error: "start, end and user_ids are required" }, 400);

      const { data: mappings, error: mappingError } = await adminClient
        .from("schedule_calendar_mappings")
        .select("user_id,calendar_id,calendar_email,enabled")
        .eq("provider", "google")
        .eq("enabled", true);
      if (mappingError) throw mappingError;

      const selected = (mappings || []).filter((m) => m.user_id === null || userIds.includes(m.user_id));
      if (!selected.length) {
        return json({ configured: false, available: false, reason: "No employee calendar mappings configured" });
      }

      const accessToken = await googleAccessToken(["https://www.googleapis.com/auth/calendar.freebusy"]);
      const data = await googleFetch("/freeBusy", accessToken, {
        method: "POST",
        body: JSON.stringify({
          timeMin: start,
          timeMax: end,
          timeZone: "Asia/Kolkata",
          items: selected.map((m) => ({ id: m.calendar_id })),
        }),
      });

      const calendars = data.calendars || {};
      const busyByCalendar: Record<string, { start: string; end: string }[]> = {};
      for (const mapping of selected) {
        busyByCalendar[mapping.calendar_id] = calendars[mapping.calendar_id]?.busy || [];
      }

      const busy = mergeBusy(busyByCalendar);
      return json({
        configured: true,
        available: busy.length === 0,
        calendars: selected.map((m) => ({
          user_id: m.user_id,
          calendar_id: m.calendar_id,
          calendar_email: m.calendar_email,
          busy: calendars[m.calendar_id]?.busy || [],
        })),
        busy,
      });
    }

    if (action === "create_event") {
      const scheduleId = String(payload.schedule_id || "");
      if (!scheduleId) return json({ error: "schedule_id is required" }, 400);

      const { data: schedule, error: scheduleError } = await adminClient
        .from("schedules")
        .select("*")
        .eq("id", scheduleId)
        .single();
      if (scheduleError || !schedule) return json({ error: "Schedule not found" }, 404);
      if (schedule.google_calendar_status === "synced" && schedule.google_calendar_event_id) {
        return json({ success: true, already_synced: true, event_id: schedule.google_calendar_event_id, event_url: schedule.google_calendar_url });
      }

      const start = String(payload.start_at || schedule.start_at);
      const end = String(payload.end_at || schedule.end_at || "");
      if (!end) return json({ error: "Schedule end time is required" }, 400);

      const { data: participants, error: participantError } = await adminClient
        .from("schedule_participants")
        .select("user_id,is_required")
        .eq("schedule_id", scheduleId);
      if (participantError) throw participantError;

      const userIds = [...new Set([
        schedule.owner_id,
        ...(participants || []).map((p) => p.user_id),
      ].filter(Boolean))];

      const { data: mappings, error: mappingError } = await adminClient
        .from("schedule_calendar_mappings")
        .select("user_id,calendar_id,calendar_email,enabled")
        .eq("provider", "google")
        .eq("enabled", true);
      if (mappingError) throw mappingError;

      const selected = (mappings || []).filter((m) => m.user_id === null || userIds.includes(m.user_id));
      if (!selected.length) return json({ error: "No Google Calendar mappings configured for this meeting" }, 400);

      const accessToken = await googleAccessToken([
        "https://www.googleapis.com/auth/calendar.freebusy",
        "https://www.googleapis.com/auth/calendar.events",
      ]);

      const freeBusy = await googleFetch("/freeBusy", accessToken, {
        method: "POST",
        body: JSON.stringify({
          timeMin: start,
          timeMax: end,
          timeZone: schedule.timezone || "Asia/Kolkata",
          items: selected.map((m) => ({ id: m.calendar_id })),
        }),
      });

      const blocking = selected.flatMap((m) => {
        const busy = freeBusy.calendars?.[m.calendar_id]?.busy || [];
        return busy.map((b: { start: string; end: string }) => ({
          ...b,
          calendar_email: m.calendar_email,
          user_id: m.user_id,
        }));
      }).filter((b) => overlaps(b, start, end));

      if (blocking.length) {
        await adminClient.from("schedules").update({ google_calendar_status: "failed" }).eq("id", scheduleId);
        return json({
          error: "Selected time is no longer available",
          code: "SLOT_CONFLICT",
          blocking,
        }, 409);
      }

      const master = selected.find((m) => m.user_id === null) || selected[0];
      const attendeeEmails = selected
        .filter((m) => m.user_id !== null && m.calendar_email)
        .map((m) => ({ email: m.calendar_email }));

      const eventBody: Record<string, unknown> = {
        id: `sankalp${scheduleId.replaceAll("-", "")}`.slice(0, 1024),
        summary: schedule.title,
        description: schedule.description || "",
        location: schedule.location_address || "",
        start: { dateTime: start, timeZone: schedule.timezone || "Asia/Kolkata" },
        end: { dateTime: end, timeZone: schedule.timezone || "Asia/Kolkata" },
        attendees: attendeeEmails,
        extendedProperties: {
          private: {
            sankalp_schedule_id: scheduleId,
            sankalp_lead_id: schedule.lead_id || "",
          },
        },
        sendUpdates: "all",
      };

      if (schedule.mode === "digital") {
        eventBody.conferenceData = {
          createRequest: {
            requestId: `meet-${scheduleId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }

      const query = schedule.mode === "digital" ? "?conferenceDataVersion=1&sendUpdates=all" : "?sendUpdates=all";
      const event = await googleFetch(`/calendars/${encodeURIComponent(master.calendar_id)}/events${query}`, accessToken, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });

      const meetLink = event.conferenceData?.entryPoints?.find((e: { entryPointType?: string }) => e.entryPointType === "video")?.uri || null;
      const { error: updateError } = await adminClient.from("schedules").update({
        google_calendar_event_id: event.id,
        google_calendar_status: "synced",
        google_calendar_url: event.htmlLink || null,
        meeting_link: schedule.mode === "digital" ? (meetLink || schedule.meeting_link) : schedule.meeting_link,
      }).eq("id", scheduleId);
      if (updateError) throw updateError;

      return json({
        success: true,
        event_id: event.id,
        event_url: event.htmlLink || null,
        meeting_link: meetLink,
      });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("google-calendar error", error);
    return json({ error: error instanceof Error ? error.message : "Google Calendar operation failed" }, 500);
  }
});
