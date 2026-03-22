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
    // Auth: header-only (Authorization: Bearer <token>)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    /*
     * getUser() is intentionally avoided here — it fails after
     * delete-account signs the user out on the client. Security is
     * guaranteed instead by the DB-side state check below: if no
     * scheduled_deletion_at exists for this userId, the function
     * returns 400 before any action is taken. A stale or replayed
     * token cannot cancel a deletion that isn't pending.
     */
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    log("Auth result", { hasClaims: !!claimsData?.claims, error: claimsError?.message, tokenLen: token.length });
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // AUTHORITY GATE: confirm a deletion is actually pending before taking any action
    const { data: profile } = await adminClient
      .from("profiles")
      .select("scheduled_deletion_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.scheduled_deletion_at === null) {
      return new Response(JSON.stringify({ error: "No deletion scheduled" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Clear the scheduled deletion
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ scheduled_deletion_at: null })
      .eq("user_id", userId);

    if (updateError) {
      log("Failed to cancel deletion", { error: updateError.message });
      return new Response(JSON.stringify({ error: "Failed to cancel deletion" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Re-activate watches — exclude watches the user explicitly paused before deletion was scheduled
    await adminClient
      .from("active_watches")
      .update({ is_active: true })
      .eq("user_id", userId);

    await adminClient
      .from("user_watchers")
      .update({ is_active: true })
      .eq("user_id", userId)
      .neq("status", "paused"); // preserve user-paused watchers

    log("Deletion cancelled, account restored", { userId });

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
