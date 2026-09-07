import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server authentication is not configured" }, 500);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session" }, 401);

  const { data: actor, error: actorError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (actorError) return json({ error: "Unable to verify administrator permissions" }, 500);
  if (String(actor?.role || "").toLowerCase() !== "admin") return json({ error: "Only administrators can change another user's password" }, 403);

  let payload: { user_id?: string; new_password?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const targetUserId = String(payload.user_id || "").trim();
  const newPassword = String(payload.new_password || "");
  if (!targetUserId) return json({ error: "Target user is required" }, 400);
  if (newPassword.length < 8) return json({ error: "New password must be at least 8 characters" }, 400);
  if (newPassword.length > 72) return json({ error: "New password is too long" }, 400);

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetError) return json({ error: "Unable to find target user" }, 500);
  if (!target) return json({ error: "Target user not found" }, 404);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (updateError) return json({ error: updateError.message }, 400);

  return json({ success: true, user_id: targetUserId, email: target.email || null });
});
