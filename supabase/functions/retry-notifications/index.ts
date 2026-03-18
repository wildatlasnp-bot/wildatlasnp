import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import { claimSendSlot } from "../_shared/notifications.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Fail-closed auth: reject if secrets are missing or token is invalid ──
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret || !serviceRoleKey) {
    console.error("CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY is not configured — rejecting request");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!token || token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, svcKey);

  try {
    // ── Kill switch: alert_sending_enabled ────────────────────────────────────
    // Row: permit_cache WHERE cache_key = '__flag_alert_sending_enabled__'
    // available = true (or row absent) → retry normally
    // available = false                → skip all retries; no notification state is mutated
    const { data: alertEnabledFlag } = await supabase
      .from("permit_cache")
      .select("available, fetched_at")
      .eq("cache_key", "__flag_alert_sending_enabled__")
      .maybeSingle();

    if (alertEnabledFlag && alertEnabledFlag.available === false) {
      console.warn(`🛑 [KILL SWITCH] alert_sending_enabled=false — retry-notifications paused (flag set at ${alertEnabledFlag.fetched_at}). Set permit_cache.__flag_alert_sending_enabled__.available=true to resume.`);
      return new Response(JSON.stringify({
        retried: 0,
        kill_switch_active: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch failed notifications that are due for retry.
    // Rows with next_retry_at = null are excluded: NULL < timestamp evaluates
    // as NULL (falsy) in SQL, so .lt() skips them — they are tombstoned entries
    // that should never be picked up again.
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

    // Resolve park names up-front so send payloads use human-readable names,
    // not raw park_id values.
    const uniqueParkIds = [...new Set(pending.map((e: any) => e.park_id))];
    const { data: parkRows } = await supabase
      .from("parks")
      .select("id, name")
      .in("id", uniqueParkIds);
    const parkNameMap = new Map<string, string>();
    for (const p of parkRows ?? []) parkNameMap.set(p.id, p.name);

    let succeeded = 0;
    let failed = 0;

    for (const entry of pending) {
      const newRetryCount = entry.retry_count + 1;
      const parkName = parkNameMap.get(entry.park_id) ?? entry.park_id;

      // ── Dedup gate ──────────────────────────────────────────────────────────
      // Every retry must race through claimSendSlot before touching any
      // downstream service.  This closes the race between concurrent fan-out
      // and retry workers processing the same failed row.
      //
      // claimSendSlot INSERTs a new notification_log row (fresh created_at),
      // keeping the claim outside fan-out's 5-min stale-claimed-row sweep window.
      // The old failed row (entry.id) is tombstoned after each outcome so it
      // is never picked up by the retry query again.
      // ────────────────────────────────────────────────────────────────────────
      const claim = await claimSendSlot(supabase, {
        queueId: entry.queue_id,
        watchId: entry.watch_id,
        userId: entry.user_id,
        parkId: entry.park_id,
        permitName: entry.permit_name,
        availableDates: entry.available_dates,
      }, entry.event_fingerprint, entry.channel, 0);

      if (claim.claimError) {
        // Transient DB error — state unknown.  Leave entry.id untouched so the
        // next retry cycle can attempt the claim again.
        console.error(`retry-notifications: claim DB error for entry ${entry.id} — deferring to next cycle`);
        continue;
      }

      if (claim.alreadySent) {
        // Another worker (fan-out or a concurrent retry) already holds the slot.
        // Tombstone entry.id so it does not re-appear in the retry queue.
        console.log(`⏭ ${entry.channel} already claimed/sent for entry ${entry.id} (fingerprint=${entry.event_fingerprint}) — tombstoning`);
        await tombstoneEntry(supabase, entry.id, "Superseded by concurrent worker — not retried");
        continue;
      }

      // Claim won — claim.logId is the new tracking row.  All send outcomes
      // update claim.logId; entry.id is tombstoned afterwards.
      if (entry.channel === "sms") {
        // Look up phone number
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_number, notify_sms, is_pro")
          .eq("user_id", entry.user_id)
          .maybeSingle();

        if (!profile?.phone_number) {
          // No phone — permanently failed; tombstone both rows.
          await supabase.from("notification_log").update({
            status: "failed",
            retry_count: newRetryCount,
            next_retry_at: null,
            error_message: "No phone number on profile",
          }).eq("id", claim.logId);
          await tombstoneEntry(supabase, entry.id, "No phone number on profile");
          failed++;
          continue;
        }

        if (!profile?.notify_sms || !profile?.is_pro) {
          const reason = !profile?.is_pro ? "User no longer Pro" : "SMS notifications disabled";
          await supabase.from("notification_log").update({
            status: "failed",
            retry_count: newRetryCount,
            next_retry_at: null,
            error_message: reason,
          }).eq("id", claim.logId);
          await tombstoneEntry(supabase, entry.id, reason);
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
              parkName,
              availableDates: entry.available_dates,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await supabase.from("notification_log").update({
              status: "sent", retry_count: newRetryCount, next_retry_at: null, error_message: null,
            }).eq("id", claim.logId);
            await tombstoneEntry(supabase, entry.id, "Succeeded on retry — tracking moved to new log row");
            succeeded++;
            await deactivateWatchIfNeeded(supabase, entry.watch_id, entry.user_id);
            // Close the originating queue row so fan-out does not re-process it.
            await closeQueueRow(supabase, entry.queue_id);
          } else {
            await markRetryFailed(supabase, claim.logId, newRetryCount, data.error || `HTTP ${res.status}`, entry);
            await tombstoneEntry(supabase, entry.id, "Failed on retry — tracking moved to new log row");
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, claim.logId, newRetryCount, err instanceof Error ? err.message : "Unknown", entry);
          await tombstoneEntry(supabase, entry.id, "Failed on retry — tracking moved to new log row");
          failed++;
        }
      } else if (entry.channel === "email") {
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, notify_email")
            .eq("user_id", entry.user_id)
            .maybeSingle();
          const userEmail = profileData?.email;
          if (!userEmail) {
            await supabase.from("notification_log").update({
              status: "failed",
              retry_count: newRetryCount,
              next_retry_at: null,
              error_message: "No email found",
            }).eq("id", claim.logId);
            await tombstoneEntry(supabase, entry.id, "No email found");
            failed++;
            continue;
          }

          if (profileData?.notify_email === false) {
            await supabase.from("notification_log").update({
              status: "failed",
              retry_count: newRetryCount,
              next_retry_at: null,
              error_message: "Email notifications disabled",
            }).eq("id", claim.logId);
            await tombstoneEntry(supabase, entry.id, "Email notifications disabled");
            failed++;
            continue;
          }

          const res = await fetch(`${supabaseUrl}/functions/v1/send-permit-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              to: userEmail,
              permitName: entry.permit_name,
              parkName,
              availableDates: entry.available_dates,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await supabase.from("notification_log").update({
              status: "sent", retry_count: newRetryCount, next_retry_at: null, error_message: null,
            }).eq("id", claim.logId);
            await tombstoneEntry(supabase, entry.id, "Succeeded on retry — tracking moved to new log row");
            succeeded++;
            await deactivateWatchIfNeeded(supabase, entry.watch_id, entry.user_id);
            // Close the originating queue row so fan-out does not re-process it.
            await closeQueueRow(supabase, entry.queue_id);
          } else {
            await markRetryFailed(supabase, claim.logId, newRetryCount, data.error || `HTTP ${res.status}`, entry);
            await tombstoneEntry(supabase, entry.id, "Failed on retry — tracking moved to new log row");
            failed++;
          }
        } catch (err) {
          await markRetryFailed(supabase, claim.logId, newRetryCount, err instanceof Error ? err.message : "Unknown", entry);
          await tombstoneEntry(supabase, entry.id, "Failed on retry — tracking moved to new log row");
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

/** Compute next retry time with exponential backoff: 2min, 8min, 32min (±10% jitter) */
function getNextRetryAt(retryCount: number): string {
  const baseDelay = 2 * 60_000 * Math.pow(4, retryCount); // 2m, 8m, 32m
  const jitter = baseDelay * (Math.random() * 0.2 - 0.1);
  const delay = Math.round(baseDelay + jitter);
  return new Date(Date.now() + delay).toISOString();
}

async function markRetryFailed(supabase: any, id: string, newRetryCount: number, errorMessage: string, entry?: any) {
  const isExhausted = newRetryCount >= 3;
  await supabase.from("notification_log").update({
    status: "failed",
    retry_count: newRetryCount,
    next_retry_at: isExhausted ? null : getNextRetryAt(newRetryCount),
    error_message: errorMessage,
  }).eq("id", id);
  if (isExhausted) {
    console.error(`❌ Notification ${id} exhausted all retries: ${errorMessage}`);
    await sendDeadLetterAlert(id, errorMessage, entry);
  }
}

/**
 * Tombstone a failed entry so the retry query (.lt("next_retry_at", now()))
 * never picks it up again.  next_retry_at = null evaluates as NULL in SQL,
 * which is not less than any timestamp — the row is permanently excluded.
 * retry_count is left unchanged to preserve exhaustion semantics on the new
 * claim row (claim.logId) that continues tracking this send attempt.
 */
async function tombstoneEntry(supabase: any, entryId: string, reason: string) {
  const { error } = await supabase
    .from("notification_log")
    .update({ next_retry_at: null, error_message: reason })
    .eq("id", entryId)
    .eq("status", "failed");
  if (error) {
    console.error(`retry-notifications: failed to tombstone entry ${entryId}: ${error.message}`);
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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
      <p class="value">${escapeHtml(permitName)} — ${escapeHtml(parkId)}</p>
      <p class="label">Channel</p>
      <p class="value">${escapeHtml(channel)}</p>
      <p class="label">User ID</p>
      <p class="value" style="font-size:12px;font-weight:400;">${escapeHtml(userId)}</p>
      <p class="label">Notification ID</p>
      <p class="value" style="font-size:12px;font-weight:400;">${escapeHtml(notificationId)}</p>
      <div class="error"><strong>Last error:</strong> ${escapeHtml(lastError)}</div>
    </div>
    <div class="footer">
      <p>WildAtlas Admin Alert — <a href="${Deno.env.get("APP_URL") ?? "https://wildatlas.app"}/admin/health" style="color:#C4956A;">View Dashboard</a></p>
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

/**
 * Mark the originating notification_queue row as 'sent' when a retry succeeds.
 * Without this, fan-out would re-process the still-pending queue row and send
 * a duplicate notification.  queue_id is null for log rows created before the
 * 20260312000007 migration — those are skipped safely.
 */
async function closeQueueRow(supabase: any, queueId: string | null | undefined) {
  if (!queueId) return;
  const { error } = await supabase
    .from("notification_queue")
    .update({ status: "sent", processed_at: new Date().toISOString() })
    .eq("id", queueId)
    .in("status", ["pending", "processing"]); // guard: only close if not already sent/exhausted
  if (error) {
    console.error(`Failed to close queue row ${queueId} after retry success:`, error.message);
  } else {
    console.log(`🔒 Queue row ${queueId} closed after retry success`);
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
