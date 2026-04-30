// Nightly cron: revoke Pro for users who've been `past_due` longer than the
// grace period. Belt-and-suspenders for the case where Stripe never fires
// `customer.subscription.deleted` (rare, but observed). Auth-protected by
// CRON_SECRET — fail-closed if the secret is missing.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders } from "../_shared/cors.ts";

const GRACE_DAYS = 3;

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ENFORCE-PAYMENT-GRACE] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: staticCorsHeaders });
  }

  // Fail-closed auth check.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    log("ERROR: CRON_SECRET not configured — refusing to run");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.headers.get("x-cron-secret");
  if (provided !== cronSecret) {
    log("Unauthorized");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    log("Sweeping past_due profiles older than cutoff", { cutoff, graceDays: GRACE_DAYS });

    const { data: stale, error: selErr } = await supabase
      .from("profiles")
      .select("user_id, payment_status_since")
      .eq("payment_status", "past_due")
      .eq("is_pro", true)
      .lt("payment_status_since", cutoff);

    if (selErr) {
      log("ERROR selecting stale profiles", { message: selErr.message });
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 500,
        headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = (stale ?? []).map((r) => r.user_id as string);
    log("Stale users found", { count: userIds.length });

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ revoked: 0 }), {
        status: 200,
        headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        is_pro: false,
        payment_status: "canceled",
        subscription_end: null,
      })
      .in("user_id", userIds);

    if (updErr) {
      log("ERROR revoking Pro on stale users", { message: updErr.message });
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Revoked Pro on stale past_due users", { count: userIds.length });
    return new Response(JSON.stringify({ revoked: userIds.length, userIds }), {
      status: 200,
      headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("CRITICAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...staticCorsHeaders, "Content-Type": "application/json" },
    });
  }
});
