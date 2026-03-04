import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── CRON_SECRET auth guard ──
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Fetch failed notifications that are due for retry
    const { data: pending, error: fetchErr } = await supabase
      .from("notification_log")
      .select("*")
      .eq("status", "failed")
      .lt("retry_count", 3)
      .lt("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ retried: 0, message: "No pending retries" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔄 Processing ${pending.length} notification retries`);

    let succeeded = 0;
    let failed = 0;

    for (const entry of pending) {
      const newRetryCount = entry.retry_count + 1;

      if (entry.channel === "sms") {
        // Look up phone number
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_number")
          .eq("user_id", entry.user_id)
          .maybeSingle();

        if (!profile?.phone_number) {
          // No phone — mark as permanently failed
          await supabase.from("notification_log").update({
            retry_count: newRetryCount,
            next_retry_at: null,
            error_message: "No phone number on profile",
          }).eq("id", entry.id);
          failed++;
          continue;
        }

        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              to: profile.phone_number,
              permitName: entry.permit_name,
              parkName: entry.park_id,
              availableDates: entry.available_dates,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await supabase.from("notification_log").update({
              status: "sent", retry_count: newRetryCount, next_retry_at: null, error_message: null,
            }).eq("id", entry.id);
            succeeded++;
            await deactivateWatchIfNeeded(supabase, entry.watch_id, entry.user_id);
          } else {
            await markRetryFailed(supabase, entry.id, newRetryCount, data.error || `HTTP ${res.status}`);
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, entry.id, newRetryCount, err instanceof Error ? err.message : "Unknown");
          failed++;
        }
      } else if (entry.channel === "email") {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(entry.user_id);
          const userEmail = authData?.user?.email;
          if (!userEmail) {
            await supabase.from("notification_log").update({
              retry_count: newRetryCount, next_retry_at: null, error_message: "No email found",
            }).eq("id", entry.id);
            failed++;
            continue;
          }

          const res = await fetch(`${supabaseUrl}/functions/v1/send-permit-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              to: userEmail,
              permitName: entry.permit_name,
              parkName: entry.park_id,
              availableDates: entry.available_dates,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await supabase.from("notification_log").update({
              status: "sent", retry_count: newRetryCount, next_retry_at: null, error_message: null,
            }).eq("id", entry.id);
            succeeded++;
            await deactivateWatchIfNeeded(supabase, entry.watch_id, entry.user_id);
          } else {
            await markRetryFailed(supabase, entry.id, newRetryCount, data.error || `HTTP ${res.status}`);
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, entry.id, newRetryCount, err instanceof Error ? err.message : "Unknown");
          failed++;
        }
      }
    }

    console.log(`✅ Retry results: ${succeeded} succeeded, ${failed} failed`);
    return new Response(
      JSON.stringify({ retried: pending.length, succeeded, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("retry-notifications error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Compute next retry time with exponential backoff: 2min, 8min, 32min */
function getNextRetryAt(retryCount: number): string {
  const delayMs = 2 * 60_000 * Math.pow(4, retryCount); // 2m, 8m, 32m
  return new Date(Date.now() + delayMs).toISOString();
}

async function markRetryFailed(supabase: any, id: string, newRetryCount: number, errorMessage: string) {
  const isExhausted = newRetryCount >= 3;
  await supabase.from("notification_log").update({
    retry_count: newRetryCount,
    next_retry_at: isExhausted ? null : getNextRetryAt(newRetryCount),
    error_message: errorMessage,
  }).eq("id", id);
  if (isExhausted) {
    console.error(`❌ Notification ${id} exhausted all retries: ${errorMessage}`);
  }
}

/** If the watch is still active and this retry succeeded, deactivate it now */
async function deactivateWatchIfNeeded(supabase: any, watchId: string, userId: string) {
  const { data: watch } = await supabase
    .from("active_watches")
    .select("is_active")
    .eq("id", watchId)
    .maybeSingle();

  if (watch?.is_active) {
    await supabase.from("active_watches").update({ status: "found", is_active: false }).eq("id", watchId);
    console.log(`🔒 Watch ${watchId} deactivated after retry success for user ${userId}`);
  }
}
