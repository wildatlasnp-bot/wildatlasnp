import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const BATCH_SIZE = 100;

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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!token || (token !== cronSecret && token !== serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── Stale claimed-row recovery ────────────────────────────────────────────
    // If a worker inserted a notification_log row with status='claimed' and then
    // crashed before updating it to 'sent' or 'failed', the partial unique index
    // on (user_id, event_fingerprint, channel) WHERE status IN ('claimed','sent')
    // would block all future sends for that user/event/channel indefinitely.
    //
    // Resolution: at the start of every fan-out invocation, sweep any 'claimed'
    // rows older than 5 minutes (matching the notification_queue reclaim window)
    // to 'failed'.  This releases the unique-index slot so the next worker can
    // claim and send.  next_retry_at = now() makes retry-notifications eligible
    // immediately.  Fresh claimed rows (< 5 min) belong to a worker still in
    // flight and are left untouched.
    const { data: recovered, error: recoveryErr } = await supabase
      .from("notification_log")
      .update({
        status: "failed",
        error_message: "claim abandoned — worker crash recovery",
        next_retry_at: new Date().toISOString(),
      })
      .eq("status", "claimed")
      .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .select("id");

    if (recoveryErr) {
      console.error("Stale claimed-row recovery failed:", recoveryErr.message);
    } else if (recovered && recovered.length > 0) {
      console.warn(`⚠️ Recovered ${recovered.length} abandoned claimed row(s) — prior worker may have crashed`);
    }

    // ── Kill switch: alert_sending_enabled ────────────────────────────────────
    // Row: permit_cache WHERE cache_key = '__flag_alert_sending_enabled__'
    // available = true (or row absent) → send normally
    // available = false                → leave all queue items pending; do not claim or send
    // Queue integrity: items remain 'pending' and will be processed when flag is re-enabled.
    // Dedup state is preserved — no notifications are marked delivered.
    const { data: alertEnabledFlag } = await supabase
      .from("permit_cache")
      .select("available, fetched_at")
      .eq("cache_key", "__flag_alert_sending_enabled__")
      .maybeSingle();

    if (alertEnabledFlag && alertEnabledFlag.available === false) {
      const { count: pendingBacklog } = await supabase
        .from("notification_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      console.warn(`🛑 [KILL SWITCH] alert_sending_enabled=false — all alert sends paused (flag set at ${alertEnabledFlag.fetched_at}). ${pendingBacklog ?? "?"} item(s) remain pending. Set permit_cache.__flag_alert_sending_enabled__.available=true to resume.`);
      return new Response(JSON.stringify({
        processed: 0,
        message: "Alert sending paused by kill switch (alert_sending_enabled=false)",
        kill_switch_active: true,
        pending_backlog: pendingBacklog ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Atomically claim rows: status 'pending' → 'processing'.
    // Uses FOR UPDATE SKIP LOCKED internally; concurrent workers receive disjoint sets.
    // Stale 'processing' rows (claimed_at > 5 min old) are automatically reclaimed.
    const { data: pending, error: fetchErr } = await supabase
      .rpc("claim_notification_queue_batch", { p_batch_size: BATCH_SIZE });

    if (fetchErr) throw fetchErr;

    // Queue-depth monitoring: warn if claimed rows were waiting too long before pickup
    const STALE_THRESHOLD_MS = 5 * 60_000; // 5 minutes
    const staleRows = (pending ?? []).filter(
      (q: any) => Date.now() - new Date(q.created_at).getTime() > STALE_THRESHOLD_MS
    );
    if (staleRows.length > 0) {
      const oldestMs = Math.max(...staleRows.map((q: any) => Date.now() - new Date(q.created_at).getTime()));
      const oldestMinutes = Math.round(oldestMs / 60_000);
      console.error(
        `⚠️ fan-out: ${staleRows.length} notification(s) older than 5 min (oldest: ${oldestMinutes} min). Fan-out may not be running on schedule.`
      );
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Queue empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 Processing ${pending.length} queued notifications`);

    const userIds = [...new Set(pending.map((q: any) => q.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, phone_number, is_pro, notify_email, notify_sms, email")
      .in("user_id", userIds);

    const profileMap = new Map<string, any>();
    for (const p of profiles ?? []) {
      profileMap.set(p.user_id, p);
    }

    const parkIds = [...new Set(pending.map((q: any) => q.park_id))];
    const permitNames = [...new Set(pending.map((q: any) => q.permit_name))];
    const { data: permitRegistry } = await supabase
      .from("park_permits")
      .select("park_id, name, recgov_permit_id")
      .in("park_id", parkIds)
      .in("name", permitNames);

    const recgovMap = new Map<string, string>();
    for (const p of permitRegistry ?? []) {
      if (p.recgov_permit_id) {
        recgovMap.set(`${p.park_id}:${p.name}`, p.recgov_permit_id);
      }
    }

    const emailMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.email) emailMap.set(p.user_id, p.email);
    }

    let sent = 0;
    let failed = 0;

    for (const item of pending) {
      const profile = profileMap.get(item.user_id);
      let anySuccess = false;

      // ── Dedup semantics ────────────────────────────────────────────────────
      // A user receives at most one alert per permit per UTC calendar day,
      // per channel.  "Same event" is defined as the same detection day —
      // not the same set of opening dates, and not permit identity alone.
      //
      // event_fingerprint = "${park_id}:${permit_name}:${YYYY-MM-DD_UTC}"
      //
      // This is the canonical identity used across all three dedup layers:
      //
      //   1. Detection layer (check-single-permit):
      //      recent_finds UNIQUE(event_fingerprint) — one detection event per
      //      permit per UTC day.  Concurrent workers that detect the same
      //      permit on the same day get a 23505 and exit without enqueuing.
      //
      //   2. Queue layer (notification_queue):
      //      UNIQUE(watch_id, park_id, permit_name) WHERE status='pending' —
      //      prevents duplicate pending rows for the same watcher.
      //      (Partial index; only one pending row at a time per watcher.)
      //
      //   3. Send layer (here, atomic claim):
      //      Inserts a notification_log row with status='claimed' before any
      //      send is attempted.  The partial unique index
      //      idx_notification_log_claim_dedup on
      //      (user_id, event_fingerprint, channel)
      //      WHERE status IN ('claimed', 'sent') AND event_fingerprint IS NOT NULL
      //      ensures only one worker can hold the claim at a time.
      //      A 23505 from the INSERT means another worker already claimed or
      //      completed the send — skip without sending.  Only the worker that
      //      wins the INSERT may call the downstream send function.
      //
      // What this means in practice:
      //   • Two concurrent workers processing the same event → one INSERT wins,
      //     other gets 23505 → exactly one send.
      //   • Two scans on the same day that detect the same permit → one alert.
      //   • A new detection on a different UTC day → new fingerprint → new alert.
      //   • Same permit opening different dates on the same UTC day → same
      //     fingerprint → one alert (the dates list in that alert reflects
      //     what was available at the moment of first detection).
      //   • Same permit, different user → different user_id → separate alert.
      //   • Same permit, different channel (email vs SMS) → separate alert.
      // ───────────────────────────────────────────────────────────────────────
      const eventFingerprint = `${item.park_id}:${item.permit_name}:${new Date(item.created_at).toISOString().split("T")[0]}`;
      const latencySeconds = Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000);

      // SMS (Pro + phone + preference)
      if (profile?.notify_sms && profile?.is_pro && profile?.phone_number) {
        const recgovId = recgovMap.get(`${item.park_id}:${item.permit_name}`);
        const claim = await claimSendSlot(supabase, item, eventFingerprint, "sms", latencySeconds);
        if (claim.alreadySent) {
          console.log(`⏭ SMS already claimed/sent for ${eventFingerprint}/${item.user_id} — skipping`);
          anySuccess = true;
        } else if (claim.logId) {
          const smsOk = await sendSms(supabaseUrl, serviceRoleKey, supabase, item, profile.phone_number, recgovId, claim.logId);
          if (smsOk) anySuccess = true;
        }
      }

      // Email
      if (profile?.notify_email !== false) {
        const userEmail = emailMap.get(item.user_id);
        if (userEmail) {
          const recgovId = recgovMap.get(`${item.park_id}:${item.permit_name}`);
          const claim = await claimSendSlot(supabase, item, eventFingerprint, "email", latencySeconds);
          if (claim.alreadySent) {
            console.log(`⏭ Email already claimed/sent for ${eventFingerprint}/${item.user_id} — skipping`);
            anySuccess = true;
          } else if (claim.logId) {
            const emailOk = await sendEmail(supabaseUrl, serviceRoleKey, supabase, item, userEmail, recgovId, claim.logId);
            if (emailOk) anySuccess = true;
          }
        }
      }

      if (anySuccess) {
        sent++;
        await supabase
          .from("notification_queue")
          .update({ status: "sent", processed_at: new Date().toISOString(), attempts: item.attempts + 1 })
          .eq("id", item.id);

        // Deactivate the user_watcher (not active_watches)
        await supabase
          .from("user_watchers")
          .update({ status: "found", is_active: false, last_notified_at: new Date().toISOString() })
          .eq("id", item.watch_id);
      } else {
        failed++;
        const newAttempts = item.attempts + 1;
        await supabase
          .from("notification_queue")
          .update({
            status: newAttempts >= 3 ? "exhausted" : "pending",
            attempts: newAttempts,
            error_message: "All channels failed",
          })
          .eq("id", item.id);

        await supabase
          .from("user_watchers")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("id", item.watch_id);
      }
    }

    console.log(`✅ Fan-out complete: ${sent} sent, ${failed} failed out of ${pending.length}`);
    return new Response(
      JSON.stringify({ processed: pending.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fan-out-notifications error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Atomically claims the send slot for (user_id, event_fingerprint, channel).
 *
 * Inserts a notification_log row with status='claimed'.  The partial unique
 * index idx_notification_log_claim_dedup on
 * (user_id, event_fingerprint, channel) WHERE status IN ('claimed', 'sent')
 * guarantees that only one worker can hold the claim at a time.
 *
 * Returns:
 *   { alreadySent: true }              — 23505: another worker already claimed
 *                                        or sent; caller must skip the send.
 *   { alreadySent: false, logId: id }  — claim won; caller may proceed to send
 *                                        and must update the row afterwards.
 *   { alreadySent: false }             — unexpected DB error; send is skipped
 *                                        defensively (no logId returned).
 */
async function claimSendSlot(
  supabase: any,
  item: any,
  eventFingerprint: string,
  channel: string,
  latencySeconds: number,
): Promise<{ alreadySent: boolean; logId?: string }> {
  const { data, error } = await supabase
    .from("notification_log")
    .insert({
      queue_id: item.id,
      event_fingerprint: eventFingerprint,
      watch_id: item.watch_id,
      user_id: item.user_id,
      channel,
      status: "claimed",
      permit_name: item.permit_name,
      park_id: item.park_id,
      available_dates: item.available_dates,
      location_name: item.park_id,
      latency_seconds: latencySeconds,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    // Unique constraint on (user_id, event_fingerprint, channel) fired —
    // another worker already claimed or sent this notification.
    return { alreadySent: true };
  }
  if (error) {
    console.error(
      `Failed to claim ${channel} send slot for ${eventFingerprint}/${item.user_id}:`,
      error.message
    );
    return { alreadySent: false }; // no logId → send skipped defensively
  }
  return { alreadySent: false, logId: data.id };
}

async function sendSms(
  supabaseUrl: string,
  serviceRoleKey: string,
  supabase: any,
  item: any,
  phone: string,
  recgovId: string | undefined,
  logId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        to: phone,
        permitName: item.permit_name,
        parkName: item.park_id,
        availableDates: item.available_dates,
        recgovId,
        watchId: item.watch_id,
      }),
    });
    const data = await res.json();
    const ok = res.ok && data.success;

    await supabase.from("notification_log").update({
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (data.error || `HTTP ${res.status}`),
      next_retry_at: ok ? null : new Date(Date.now() + 2 * 60_000).toISOString(),
    }).eq("id", logId);

    return ok;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown";
    await supabase.from("notification_log").update({
      status: "failed",
      error_message: errMsg,
      next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
    }).eq("id", logId);
    return false;
  }
}

async function sendEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  supabase: any,
  item: any,
  email: string,
  recgovPermitId: string | undefined,
  logId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-permit-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        to: email,
        permitName: item.permit_name,
        parkName: item.park_id,
        availableDates: item.available_dates,
        recgovPermitId,
      }),
    });
    const data = await res.json();
    const ok = res.ok && data.success;

    await supabase.from("notification_log").update({
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (data.error || `HTTP ${res.status}`),
      next_retry_at: ok ? null : new Date(Date.now() + 2 * 60_000).toISOString(),
    }).eq("id", logId);

    return ok;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown";
    await supabase.from("notification_log").update({
      status: "failed",
      error_message: errMsg,
      next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
    }).eq("id", logId);
    return false;
  }
}
