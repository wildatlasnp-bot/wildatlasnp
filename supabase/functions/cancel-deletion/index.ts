import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: unknown) => {
  const d = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-DELETION] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Auth: prefer Authorization header, fall back to body._authToken (handles platform header stripping)
    const headerAuth = req.headers.get("Authorization");
    let bodyToken: string | null = null;
    try {
      const body = await req.json();
      bodyToken = typeof body._authToken === "string" ? body._authToken : null;
    } catch { /* no body or non-JSON — fine */ }

    const effectiveAuth = headerAuth || (bodyToken ? `Bearer ${bodyToken}` : null);
    if (!effectiveAuth) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = effectiveAuth.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: effectiveAuth } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Clear the scheduled deletion
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ scheduled_deletion_at: null })
      .eq("user_id", user.id);

    if (updateError) {
      log("Failed to cancel deletion", { error: updateError.message });
      return new Response(JSON.stringify({ error: "Failed to cancel deletion" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Re-activate watches
    await adminClient
      .from("active_watches")
      .update({ is_active: true })
      .eq("user_id", user.id);

    await adminClient
      .from("user_watchers")
      .update({ is_active: true })
      .eq("user_id", user.id);

    log("Deletion cancelled, account restored", { userId: user.id });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cancel-deletion error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
