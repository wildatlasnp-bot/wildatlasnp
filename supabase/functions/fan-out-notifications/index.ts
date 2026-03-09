import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://wildatlasnp.lovable.app", "http://localhost:8080"];

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: pending, error: fetchErr } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
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

    const permitKeys = [...new Set(pending.map((q: any) => `${q.park_id}:${q.permit_name}`))];
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

      // SMS (Pro + phone + preference)
      if (profile?.notify_sms && profile?.is_pro && profile?.phone_number) {
        const recgovId = recgovMap.get(`${item.park_id}:${item.permit_name}`);
        const smsOk = await sendSms(supabaseUrl, serviceRoleKey, supabase, item, profile.phone_number, recgovId);
        if (smsOk) anySuccess = true;
      }

      // Email
      if (profile?.notify_email !== false) {
        const userEmail = emailMap.get(item.user_id);
        if (userEmail) {
          const recgovId = recgovMap.get(`${item.park_id}:${item.permit_name}`);
          const emailOk = await sendEmail(supabaseUrl, serviceRoleKey, supabase, item, userEmail, recgovId);
          if (emailOk) anySuccess = true;
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

async function sendSms(
  supabaseUrl: string,
  serviceRoleKey: string,
  supabase: any,
  item: any,
  phone: string,
  recgovId?: string
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

    await supabase.from("notification_log").insert({
      watch_id: item.watch_id,
      user_id: item.user_id,
      channel: "sms",
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (data.error || `HTTP ${res.status}`),
      permit_name: item.permit_name,
      park_id: item.park_id,
      available_dates: item.available_dates,
      next_retry_at: ok ? null : new Date(Date.now() + 2 * 60_000).toISOString(),
      location_name: item.park_id,
      latency_seconds: Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000),
    });

    return ok;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown";
    await supabase.from("notification_log").insert({
      watch_id: item.watch_id,
      user_id: item.user_id,
      channel: "sms",
      status: "failed",
      error_message: errMsg,
      permit_name: item.permit_name,
      park_id: item.park_id,
      available_dates: item.available_dates,
      next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
      location_name: item.park_id,
      latency_seconds: Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000),
    });
    return false;
  }
}

async function sendEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  supabase: any,
  item: any,
  email: string,
  recgovPermitId?: string
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

    await supabase.from("notification_log").insert({
      watch_id: item.watch_id,
      user_id: item.user_id,
      channel: "email",
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (data.error || `HTTP ${res.status}`),
      permit_name: item.permit_name,
      park_id: item.park_id,
      available_dates: item.available_dates,
      next_retry_at: ok ? null : new Date(Date.now() + 2 * 60_000).toISOString(),
      location_name: item.park_id,
      latency_seconds: Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000),
    });

    return ok;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown";
    await supabase.from("notification_log").insert({
      watch_id: item.watch_id,
      user_id: item.user_id,
      channel: "email",
      status: "failed",
      error_message: errMsg,
      permit_name: item.permit_name,
      park_id: item.park_id,
      available_dates: item.available_dates,
      next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
      location_name: item.park_id,
      latency_seconds: Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000),
    });
    return false;
  }
}
