import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


const STALE_THRESHOLD_MS = 10 * 60_000; // 10 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth guard
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (cronSecret) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token !== cronSecret && token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check heartbeat
    const { data: heartbeat } = await supabase
      .from("permit_cache")
      .select("fetched_at, error_count, last_error")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle();

    const now = Date.now();
    let status = "healthy";
    let message = "Scanner is running normally";
    let alertSent = false;
    let zeroFindsWarning = false;

    if (!heartbeat) {
      status = "no_heartbeat";
      message = "No scanner heartbeat found — scanner may have never run";
      await sendAdminAlert("No Scanner Heartbeat", message);
      alertSent = true;
    } else {
      const lastBeat = new Date(heartbeat.fetched_at).getTime();
      const staleDuration = now - lastBeat;

      if (staleDuration > STALE_THRESHOLD_MS) {
        const staleMinutes = Math.round(staleDuration / 60_000);
        status = "stale";
        message = `Scanner heartbeat is ${staleMinutes} minutes old — scanner may have stopped`;
        await sendAdminAlert("Scanner Heartbeat Stale", `Last heartbeat was ${staleMinutes} minutes ago. The permit scanner may have stopped running.\n\nLast error: ${heartbeat.last_error || "None"}\nError count: ${heartbeat.error_count}`);
        alertSent = true;
      } else if (heartbeat.error_count > 0) {
        status = "degraded";
        message = `Scanner running with ${heartbeat.error_count} worker errors on last cycle`;
      }
    }

    // Check for tripped circuit breakers and alert
    const { data: tripped } = await supabase
      .from("permit_cache")
      .select("cache_key, error_count, last_error, last_status_code, fetched_at")
      .gte("error_count", 3)
      .neq("cache_key", "__scanner_heartbeat__")
      .neq("cache_key", "__global_rate_limit__");

    if (tripped && tripped.length > 0) {
      const permitList = tripped.map((t) => `• ${t.cache_key}: ${t.error_count} errors — ${t.last_error || "Unknown"} (status ${t.last_status_code})`).join("\n");
      await sendAdminAlert(
        `${tripped.length} Circuit Breaker(s) Tripped`,
        `The following permits have hit the circuit breaker threshold (3+ consecutive errors):\n\n${permitList}\n\nThese permits are temporarily paused with exponential backoff. Check if Recreation.gov API structure has changed.`
      );
      alertSent = true;
    }

    // ── Zero-finds watchdog ──────────────────────────────────────────────
    // If active watches exist but no recent_finds in the last 24h, alert
    const ZERO_FINDS_THRESHOLD_H = 24;
    const { count: activeWatchCount } = await supabase
      .from("user_watchers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (activeWatchCount && activeWatchCount > 0) {
      const cutoff = new Date(now - ZERO_FINDS_THRESHOLD_H * 3600_000).toISOString();
      const { count: recentFindCount } = await supabase
        .from("recent_finds")
        .select("*", { count: "exact", head: true })
        .gte("found_at", cutoff);

      if (!recentFindCount || recentFindCount === 0) {
        zeroFindsWarning = true;
        await sendAdminAlert(
          "Zero Permit Finds in 24h",
          `There are ${activeWatchCount} active watches but zero permit detections in the last ${ZERO_FINDS_THRESHOLD_H} hours.\n\nThis could indicate:\n• Recreation.gov API changes\n• Scanner silently failing\n• All permits genuinely unavailable\n\nCheck the admin health dashboard for details.`
        );
        alertSent = true;
        status = status === "healthy" ? "warning" : status;
        message += ` | Zero finds in ${ZERO_FINDS_THRESHOLD_H}h`;
      }
    }

    // ── Fan-out crash recovery: reset stale pending queue items ──────────
    const STALE_QUEUE_THRESHOLD_MS = 5 * 60_000; // 5 minutes
    const staleCutoff = new Date(now - STALE_QUEUE_THRESHOLD_MS).toISOString();
    const { data: staleItems, count: staleCount } = await supabase
      .from("notification_queue")
      .select("id", { count: "exact" })
      .eq("status", "pending")
      .lt("created_at", staleCutoff)
      .is("processed_at", null);

    if (staleItems && staleItems.length > 0) {
      const staleIds = staleItems.map((i: any) => i.id);
      await supabase
        .from("notification_queue")
        .update({ status: "pending", error_message: "Reset by health-check: stale pending item" })
        .in("id", staleIds);

      console.log(`🔄 Reset ${staleIds.length} stale notification_queue items for re-processing`);

      // Trigger fan-out to pick them up
      try {
        await fetch(`${supabaseUrl}/functions/v1/fan-out-notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ source: "health-check-recovery" }),
        });
        console.log(`🚀 Triggered fan-out-notifications for crash recovery`);
      } catch (err) {
        console.error("Failed to trigger fan-out recovery:", err);
      }
    }

    return new Response(
      JSON.stringify({
        status,
        message,
        alert_sent: alertSent,
        heartbeat: heartbeat
          ? { last_beat: heartbeat.fetched_at, error_count: heartbeat.error_count }
          : null,
        circuit_breakers_tripped: tripped?.length ?? 0,
        zero_finds_warning: zeroFindsWarning,
        stale_queue_reset: staleCount ?? 0,
      }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scanner-health-check error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

async function sendAdminAlert(subject: string, body: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — skipping admin alert");
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
  body { margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#2D3B2D; }
  .container { max-width:520px; margin:0 auto; padding:40px 24px; }
  .header { text-align:center; margin-bottom:24px; }
  .icon { font-size:36px; margin-bottom:8px; }
  .title { font-size:18px; font-weight:700; color:#B91C1C; margin:0 0 4px; }
  .card { background:#FEF2F2; border-radius:12px; padding:20px; margin-bottom:16px; border:1px solid #FECACA; }
  .body-text { font-size:14px; line-height:1.6; white-space:pre-wrap; color:#2D3B2D; }
  .footer { text-align:center; font-size:11px; color:#A09888; margin-top:24px; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🚨</div>
      <h1 class="title">${subject}</h1>
    </div>
    <div class="card">
      <p class="body-text">${body}</p>
    </div>
    <div class="footer">
      <p>WildAtlas Scanner Monitor — <a href="https://wildatlas.lovable.app/admin/health" style="color:#C4956A;">View Dashboard</a></p>
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
        subject: `🚨 ${subject}`,
        html,
      }),
    });
    if (res.ok) {
      console.log(`📧 Admin alert sent: ${subject}`);
    } else if (res.status === 429) {
      console.warn(`⚠️ Resend daily quota exhausted — skipping admin alert: ${subject}`);
    } else {
      console.error(`Failed to send admin alert: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Admin alert send error:", err instanceof Error ? err.message : err);
  }
}
