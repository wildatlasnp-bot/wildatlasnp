import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


const STALE_THRESHOLD_MS = 10 * 60_000; // 10 minutes
const ADMIN_ALERT_DEDUP_MS = 60 * 60_000; // 60 minutes — suppress duplicate admin alerts within window

// Stable internal keys for per-type admin alert dedup sentinel rows in permit_cache.
// Each key tracks the last-sent timestamp for one alert category independently.
const ALERT_KEY_OFFLINE         = "__admin_alert__offline__";
const ALERT_KEY_DEGRADED        = "__admin_alert__degraded__";        // reserved; not currently emitted
const ALERT_KEY_WARNING         = "__admin_alert__warning__";         // reserved; not currently emitted
const ALERT_KEY_SCHEMA_DRIFT    = "__admin_alert__schema_drift__";
const ALERT_KEY_ZERO_FINDS      = "__admin_alert__zero_finds__";
const ALERT_KEY_CIRCUIT_BREAKER = "__admin_alert__circuit_breaker__";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth guard — fail-closed: 500 if env missing, 401 if token wrong/absent
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token || token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check heartbeat
    const { data: heartbeat } = await supabase
      .from("permit_cache")
      .select("fetched_at, error_count, last_error, available")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle();

    const now = Date.now();
    // ── Status priority: offline > degraded > slowed > warning > healthy ────
    let status = "healthy";
    let message = "Scanner is running normally";
    let alertSent = false;
    let zeroFindsWarning = false;
    let slowedEndpoints: string[] = [];

    if (!heartbeat) {
      status = "offline";
      message = "No scanner heartbeat found — scanner may never have run";
      await sendAdminAlert(supabase, ALERT_KEY_OFFLINE, "Scanner Offline", message);
      alertSent = true;
    } else {
      const lastBeat = new Date(heartbeat.fetched_at).getTime();
      const staleDuration = now - lastBeat;

      if (staleDuration > STALE_THRESHOLD_MS) {
        const staleMinutes = Math.round(staleDuration / 60_000);
        status = "offline";
        message = `Scanner heartbeat is ${staleMinutes} minutes old — scanner has stopped`;
        await sendAdminAlert(
          supabase,
          ALERT_KEY_OFFLINE,
          "Scanner Offline",
          `Last heartbeat was ${staleMinutes} minutes ago. The permit scanner has stopped running.\n\nLast error: ${heartbeat.last_error || "None"}\nError count: ${heartbeat.error_count}\n\nUsers with active watches are NOT being monitored.`
        );
        alertSent = true;
      } else if (heartbeat.error_count > 0) {
        status = "degraded";
        message = `Scanner running with ${heartbeat.error_count} worker error(s) on last cycle`;
      }
    }

    // Check for tripped circuit breakers — distinguish schema drift from other errors
    const { data: tripped } = await supabase
      .from("permit_cache")
      .select("cache_key, error_count, last_error, last_status_code, fetched_at")
      .gte("error_count", 3)
      .neq("cache_key", "__scanner_heartbeat__")
      .neq("cache_key", "__global_rate_limit__");

    if (tripped && tripped.length > 0) {
      // Tripped circuits → push status to degraded (offline takes precedence)
      if (status === "healthy" || status === "slowed" || status === "warning") {
        status = "degraded";
      }

      // Schema drift errors are a code problem, not a transient upstream issue — alert separately
      const driftPermits = tripped.filter((t: any) => t.last_error?.includes("REC_GOV_SCHEMA_DRIFT"));
      const otherTripped = tripped.filter((t: any) => !t.last_error?.includes("REC_GOV_SCHEMA_DRIFT"));

      if (driftPermits.length > 0) {
        const driftList = driftPermits.map((t: any) =>
          `• ${t.cache_key}: ${t.last_error}`
        ).join("\n");
        await sendAdminAlert(
          supabase,
          ALERT_KEY_SCHEMA_DRIFT,
          `Schema Drift: ${driftPermits.length} Permit Parser(s) Broken`,
          `Recreation.gov API response format has changed for the following permit(s):\n\n${driftList}\n\nThese permits are circuit-broken and are NOT being monitored. Users watching them will NOT receive alerts.\n\nThis requires a parser code fix — it will not self-recover.`
        );
        alertSent = true;
      }

      if (otherTripped.length > 0) {
        const permitList = otherTripped.map((t: any) =>
          `• ${t.cache_key}: ${t.error_count} errors — ${t.last_error || "Unknown"} (HTTP ${t.last_status_code})`
        ).join("\n");
        await sendAdminAlert(
          supabase,
          ALERT_KEY_CIRCUIT_BREAKER,
          `${otherTripped.length} Circuit Breaker(s) Tripped`,
          `The following permits have hit the circuit breaker threshold (3+ consecutive errors):\n\n${permitList}\n\nThese permits are temporarily paused with exponential backoff. Check if Recreation.gov is returning errors.`
        );
        alertSent = true;
      }
    }

    // ── Slowed state: rate-limit or endpoint circuit backoff active ──────────
    // Only overrides healthy/warning — degraded and offline take precedence.
    const { data: openCircuits } = await supabase
      .from("endpoint_circuit_breakers")
      .select("endpoint_key, consecutive_429s, cooldown_until")
      .eq("state", "open")
      .gt("cooldown_until", new Date(now).toISOString());

    if (openCircuits && openCircuits.length > 0) {
      for (const c of openCircuits) {
        slowedEndpoints.push(`${c.endpoint_key} (429×${c.consecutive_429s}, until ${c.cooldown_until})`);
      }
    }

    const { data: globalRateLimit } = await supabase
      .from("permit_cache")
      .select("stale_at, error_count")
      .eq("cache_key", "__global_rate_limit__")
      .maybeSingle();

    if (globalRateLimit && globalRateLimit.error_count > 0 && new Date(globalRateLimit.stale_at) > new Date(now)) {
      slowedEndpoints.push(`global (backoff until ${globalRateLimit.stale_at})`);
    }

    if (slowedEndpoints.length > 0 && (status === "healthy" || status === "warning")) {
      status = "slowed";
      message = `Scanner in rate-limit backoff: ${slowedEndpoints.join("; ")}`;
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
          supabase,
          ALERT_KEY_ZERO_FINDS,
          "Zero Permit Finds in 24h",
          `There are ${activeWatchCount} active watches but zero permit detections in the last ${ZERO_FINDS_THRESHOLD_H} hours.\n\nThis could indicate:\n• Recreation.gov API changes (check for REC_GOV_SCHEMA_DRIFT circuit breakers above)\n• Scanner silently failing\n• All permits genuinely unavailable\n\nCurrent scanner status: ${status}\n\nCheck the admin health dashboard for details.`
        );
        alertSent = true;
        // Zero finds alone → warning; combined with slowed → degraded (silent monitoring risk)
        if (status === "healthy") {
          status = "warning";
          message += ` | Zero finds in ${ZERO_FINDS_THRESHOLD_H}h`;
        } else if (status === "slowed") {
          status = "degraded";
          message += ` | Zero finds in ${ZERO_FINDS_THRESHOLD_H}h while rate-limited`;
        } else {
          message += ` | Zero finds in ${ZERO_FINDS_THRESHOLD_H}h`;
        }
      }
    }

    // ── Fan-out crash recovery: detect stale queue items and trigger fan-out ──
    // Stale = unclaimed ('pending' for >5 min) or abandoned ('processing' with expired claim).
    // The claim function atomically reclaims stale 'processing' rows; no manual reset needed.
    const STALE_QUEUE_THRESHOLD_MS = 5 * 60_000; // 5 minutes
    const staleCutoff = new Date(now - STALE_QUEUE_THRESHOLD_MS).toISOString();
    const { data: staleItems, count: staleCount } = await supabase
      .from("notification_queue")
      .select("id", { count: "exact" })
      .or(`and(status.eq.pending,created_at.lt.${staleCutoff}),and(status.eq.processing,claimed_at.lt.${staleCutoff})`)
      .is("processed_at", null);

    if (staleCount && staleCount > 0) {
      console.log(`🔄 ${staleCount} stale notification_queue item(s) detected — triggering fan-out for reclaim`);

      // Trigger fan-out; the claim function will atomically reclaim any stale rows.
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

    // ── Kill switch observability: read all runtime flags ────────────────────
    // Flags are stored as permit_cache sentinel rows. Absent row = default (true/false per flag).
    // This block only reports state — scanner-health-check never modifies flags.
    const [
      { data: flagScanner },
      { data: flagAlert },
      { data: flagDegradedForce },
    ] = await Promise.all([
      supabase.from("permit_cache").select("available, fetched_at").eq("cache_key", "__flag_scanner_enabled__").maybeSingle(),
      supabase.from("permit_cache").select("available, fetched_at").eq("cache_key", "__flag_alert_sending_enabled__").maybeSingle(),
      supabase.from("permit_cache").select("available, fetched_at").eq("cache_key", "__flag_degraded_mode_force__").maybeSingle(),
    ]);

    const scannerEnabled    = flagScanner?.available     ?? true;   // default: true
    const alertEnabled      = flagAlert?.available        ?? true;   // default: true
    const degradedModeForce = flagDegradedForce?.available ?? false; // default: false

    // degraded_mode_force: available=true → force reported status to 'degraded' (operator incident signal)
    //                      available=false (or row absent) → no override; status reflects real state
    // Only affects the reported status field — does not change scanner execution or suppress alerts.
    if (degradedModeForce && (status === "healthy" || status === "slowed" || status === "warning")) {
      console.warn(`⚠️ [KILL SWITCH] degraded_mode_force=true — overriding computed status '${status}' to 'degraded' for operator-declared incident (flag set at ${flagDegradedForce?.fetched_at}).`);
      status = "degraded";
      message = `[Operator override] ${message}`;
    }

    return new Response(
      JSON.stringify({
        status,
        message,
        alert_sent: alertSent,
        heartbeat: heartbeat
          ? { last_beat: heartbeat.fetched_at, error_count: heartbeat.error_count, all_workers_failed: heartbeat.available === false }
          : null,
        circuit_breakers_tripped: tripped?.length ?? 0,
        schema_drift_tripped: tripped?.filter((t: any) => t.last_error?.includes("REC_GOV_SCHEMA_DRIFT")).length ?? 0,
        slowed_endpoints: slowedEndpoints,
        zero_finds_warning: zeroFindsWarning,
        stale_queue_reset: staleCount ?? 0,
        kill_switches: {
          scanner_enabled:       scannerEnabled,
          scanner_flag_set_at:   flagScanner?.fetched_at ?? null,
          alert_sending_enabled: alertEnabled,
          alert_flag_set_at:     flagAlert?.fetched_at ?? null,
          degraded_mode_force:   degradedModeForce,
          degraded_flag_set_at:  flagDegradedForce?.fetched_at ?? null,
        },
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

async function sendAdminAlert(supabase: any, alertKey: string, subject: string, body: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — skipping admin alert");
    return;
  }

  // ── Per-type dedup: suppress if this alert type was already sent within the last 60 minutes ──
  // Uses the permit_cache sentinel row pattern: fetched_at records when the alert last fired.
  // Each alertKey is checked independently — one type being suppressed does not affect others.
  const nowMs = Date.now();
  const { data: sentinel } = await supabase
    .from("permit_cache")
    .select("fetched_at")
    .eq("cache_key", alertKey)
    .maybeSingle();

  if (sentinel) {
    const elapsed = nowMs - new Date(sentinel.fetched_at).getTime();
    if (elapsed < ADMIN_ALERT_DEDUP_MS) {
      console.log(`⏭ Admin alert suppressed (sent ${Math.round(elapsed / 60_000)}m ago): ${subject}`);
      return;
    }
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
      <p>WildAtlas Scanner Monitor — <a href="${Deno.env.get("APP_URL") ?? "https://wildatlas.app"}/admin/health" style="color:#C4956A;">View Dashboard</a></p>
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
      // Stamp the sentinel row so this alert type is suppressed for the next 60 minutes.
      await supabase.from("permit_cache").upsert(
        {
          cache_key: alertKey,
          recgov_id: "admin_alert",
          api_type: "admin_alert",
          available: true,
          available_dates: [],
          fetched_at: new Date(nowMs).toISOString(),
          stale_at: new Date(nowMs + ADMIN_ALERT_DEDUP_MS).toISOString(),
          expires_at: new Date(nowMs + 24 * 3600_000).toISOString(),
          error_count: 0,
          last_error: null,
          last_status_code: null,
        },
        { onConflict: "cache_key" }
      );
    } else if (res.status === 429) {
      console.warn(`⚠️ Resend daily quota exhausted — skipping admin alert: ${subject}`);
    } else {
      console.error(`Failed to send admin alert: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Admin alert send error:", err instanceof Error ? err.message : err);
  }
}
