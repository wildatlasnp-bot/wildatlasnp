import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://wildatlasnp.lovable.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth guard: fail closed — reject if CRON_SECRET is not configured ──
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured — rejecting request");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== cronSecret && token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, svcKey);

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
            await markRetryFailed(supabase, entry.id, newRetryCount, data.error || `HTTP ${res.status}`, entry);
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, entry.id, newRetryCount, err instanceof Error ? err.message : "Unknown", entry);
          failed++;
        }
      } else if (entry.channel === "email") {
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email")
            .eq("user_id", entry.user_id)
            .maybeSingle();
          const userEmail = profileData?.email;
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
            await markRetryFailed(supabase, entry.id, newRetryCount, data.error || `HTTP ${res.status}`, entry);
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, entry.id, newRetryCount, err instanceof Error ? err.message : "Unknown", entry);
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

async function markRetryFailed(supabase: any, id: string, newRetryCount: number, errorMessage: string, entry?: any) {
  const isExhausted = newRetryCount >= 3;
  await supabase.from("notification_log").update({
    retry_count: newRetryCount,
    next_retry_at: isExhausted ? null : getNextRetryAt(newRetryCount),
    error_message: errorMessage,
  }).eq("id", id);
  if (isExhausted) {
    console.error(`❌ Notification ${id} exhausted all retries: ${errorMessage}`);
    await sendDeadLetterAlert(id, errorMessage, entry);
  }
}

/** Send a dead-letter admin alert email when all retries are exhausted */
async function sendDeadLetterAlert(notificationId: string, lastError: string, entry?: any) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — skipping dead-letter admin alert");
    return;
  }

  const permitName = entry?.permit_name ?? "Unknown";
  const parkId = entry?.park_id ?? "Unknown";
  const channel = entry?.channel ?? "Unknown";
  const userId = entry?.user_id ?? "Unknown";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
  body { margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#2D3B2D; }
  .container { max-width:520px; margin:0 auto; padding:40px 24px; }
  .header { text-align:center; margin-bottom:24px; }
  .icon { font-size:36px; margin-bottom:8px; }
  .title { font-size:18px; font-weight:700; color:#B91C1C; margin:0 0 4px; }
  .subtitle { font-size:12px; color:#8B7D6B; margin:0; }
  .card { background:#FEF2F2; border-radius:12px; padding:20px; margin-bottom:16px; border:1px solid #FECACA; }
  .label { font-size:11px; color:#6B5D4D; text-transform:uppercase; letter-spacing:1px; margin:0 0 4px; }
  .value { font-size:14px; color:#2D3B2D; margin:0 0 12px; font-weight:600; }
  .error { background:#FFF7ED; border-radius:8px; padding:12px; font-size:13px; color:#92400E; margin-top:8px; word-break:break-all; }
  .footer { text-align:center; font-size:11px; color:#A09888; margin-top:24px; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🚨</div>
      <h1 class="title">Dead Letter: Notification Failed</h1>
      <p class="subtitle">All 3 retry attempts exhausted</p>
    </div>
    <div class="card">
      <p class="label">Permit</p>
      <p class="value">${permitName} — ${parkId}</p>
      <p class="label">Channel</p>
      <p class="value">${channel}</p>
      <p class="label">User ID</p>
      <p class="value" style="font-size:12px;font-weight:400;">${userId}</p>
      <p class="label">Notification ID</p>
      <p class="value" style="font-size:12px;font-weight:400;">${notificationId}</p>
      <div class="error"><strong>Last error:</strong> ${lastError}</div>
    </div>
    <div class="footer">
      <p>WildAtlas Admin Alert — <a href="https://wildatlas.lovable.app/admin/health" style="color:#C4956A;">View Dashboard</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mochi 🐻 <mochi@alerts.wildatlas.app>",
        to: ["admin@wildatlas.app"],
        subject: `🚨 Dead Letter: ${permitName} (${channel}) — retries exhausted`,
        html,
      }),
    });
    if (res.ok) {
      console.log(`📧 Dead-letter admin alert sent for notification ${notificationId}`);
    } else {
      const data = await res.text();
      console.error(`Failed to send dead-letter alert: ${res.status} ${data}`);
    }
  } catch (err) {
    console.error("Dead-letter alert send error:", err instanceof Error ? err.message : err);
  }
}

/** If the watch is still active and this retry succeeded, deactivate it now */
async function deactivateWatchIfNeeded(supabase: any, watchId: string, userId: string) {
  const { data: watch } = await supabase
    .from("user_watchers")
    .select("is_active")
    .eq("id", watchId)
    .maybeSingle();

  if (watch?.is_active) {
    await supabase.from("user_watchers").update({ status: "found", is_active: false }).eq("id", watchId);
    console.log(`🔒 Watcher ${watchId} deactivated after retry success for user ${userId}`);
  }
}
