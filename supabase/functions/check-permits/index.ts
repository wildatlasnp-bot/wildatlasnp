import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECGOV_HEADERS = {
  "User-Agent": "WildAtlas/1.0 (permit-availability-checker)",
  Accept: "application/json",
};

const DELAY_BETWEEN_REQUESTS_MS = 500;
const CACHE_HOT_TTL_MINUTES = 5;
const CACHE_STALE_TTL_HOURS = 24;
const MAX_BACKOFF_MS = 120_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with jitter */
function getBackoffMs(errorCount: number): number {
  const base = Math.min(30_000 * Math.pow(2, errorCount - 1), MAX_BACKOFF_MS);
  const jitter = Math.random() * base * 0.3;
  return base + jitter;
}

// ─── Fetch helpers (unchanged logic, but now return status codes) ────────────

interface FetchResult {
  available: boolean;
  availableDates: string[];
  statusCode?: number;
  error?: string;
}

async function checkStandardPermit(recgovId: string): Promise<FetchResult> {
  const availableDates: string[] = [];
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const startDate = monthStart.toISOString().split("T")[0] + "T00:00:00.000Z";
    const url = `https://www.recreation.gov/api/permits/${recgovId}/availability/month?start_date=${startDate}`;
    console.log(`Polling (standard): ${url}`);

    const res = await fetch(url, { headers: RECGOV_HEADERS });
    if (res.status === 429) return { available: false, availableDates: [], statusCode: 429, error: "Rate limited" };
    if (!res.ok) {
      console.error(`Recreation.gov returned ${res.status} for standard permit ${recgovId}`);
      await res.text();
      return { available: false, availableDates: [], statusCode: res.status, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const availability = data?.payload?.availability;
    if (!availability) continue;

    for (const divisionId of Object.keys(availability)) {
      const division = availability[divisionId];
      const dates = division?.date_availability || division;
      if (typeof dates !== "object" || dates === null) continue;
      for (const [dateStr, info] of Object.entries(dates)) {
        const slot = info as { remaining: number };
        if (new Date(dateStr) <= now) continue;
        if (slot.remaining > 0) availableDates.push(dateStr);
      }
    }

    // Delay between month requests
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return { available: availableDates.length > 0, availableDates: availableDates.slice(0, 10), statusCode: 200 };
}

async function checkInyoPermit(recgovId: string): Promise<FetchResult> {
  const availableDates: string[] = [];
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
    const url = `https://www.recreation.gov/api/permitinyo/${recgovId}/availability?start_date=${startDate}&end_date=${endDate}`;
    console.log(`Polling (permitinyo): ${url}`);

    const res = await fetch(url, { headers: RECGOV_HEADERS });
    if (res.status === 429) return { available: false, availableDates: [], statusCode: 429, error: "Rate limited" };
    if (!res.ok) {
      await res.text();
      return { available: false, availableDates: [], statusCode: res.status, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const payload = data?.payload;
    if (!payload || typeof payload !== "object") continue;

    for (const [dateStr, trailheads] of Object.entries(payload)) {
      if (new Date(dateStr) <= now) continue;
      if (typeof trailheads !== "object" || trailheads === null) continue;
      for (const th of Object.values(trailheads as Record<string, any>)) {
        if (th?.remaining > 0) {
          availableDates.push(dateStr);
          break;
        }
      }
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return { available: availableDates.length > 0, availableDates: availableDates.slice(0, 10), statusCode: 200 };
}

async function checkItineraryPermit(recgovId: string): Promise<FetchResult> {
  const availableDates: string[] = [];
  const now = new Date();

  let divisionIds: string[] = [];
  const contentUrl = `https://www.recreation.gov/api/permitcontent/${recgovId}`;
  console.log(`Fetching divisions: ${contentUrl}`);
  const contentRes = await fetch(contentUrl, { headers: RECGOV_HEADERS });
  if (contentRes.status === 429) return { available: false, availableDates: [], statusCode: 429, error: "Rate limited" };
  if (!contentRes.ok) {
    await contentRes.text();
    return { available: false, availableDates: [], statusCode: contentRes.status, error: `HTTP ${contentRes.status}` };
  }
  const contentData = await contentRes.json();
  const payload = contentData?.payload;
  const divisions = payload?.divisions || payload?.permit_divisions;
  if (divisions && typeof divisions === "object") {
    if (Array.isArray(divisions)) {
      divisionIds = divisions.map((d: any) => d.id || d.division_id).filter(Boolean);
    } else {
      divisionIds = Object.keys(divisions);
    }
  }
  console.log(`Found ${divisionIds.length} divisions for permit ${recgovId}`);

  if (divisionIds.length === 0) return { available: false, availableDates: [], statusCode: 200 };

  const sampled = divisionIds.slice(0, 10);
  const months = [
    { month: now.getMonth() + 1, year: now.getFullYear() },
    { month: now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2, year: now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear() },
  ];

  for (const div of sampled) {
    for (const { month, year } of months) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      const url = `https://www.recreation.gov/api/permititinerary/${recgovId}/division/${div}/availability/month?month=${month}&year=${year}`;
      const res = await fetch(url, { headers: RECGOV_HEADERS });
      if (res.status === 429) return { available: availableDates.length > 0, availableDates: [...new Set(availableDates)].slice(0, 10), statusCode: 429, error: "Rate limited" };
      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      const quotaMaps = data?.payload?.quota_type_maps;
      if (!quotaMaps) continue;

      const memberDaily = quotaMaps.QuotaUsageByMemberDaily || {};
      const constantDaily = quotaMaps.ConstantQuotaUsageDaily || {};

      for (const [dateStr, info] of Object.entries(memberDaily) as [string, any][]) {
        if (new Date(dateStr) <= now) continue;
        const constantInfo = constantDaily[dateStr] as any;
        if (!constantInfo || constantInfo.remaining <= 0) continue;
        if (info.remaining > 0 && !info.show_walkup && !info.is_hidden) {
          availableDates.push(dateStr);
        }
      }
    }
    if (availableDates.length > 0) break;
  }

  const unique = [...new Set(availableDates)];
  return { available: unique.length > 0, availableDates: unique.slice(0, 10), statusCode: 200 };
}

async function fetchPermitFromApi(recgovId: string, apiType: string): Promise<FetchResult> {
  try {
    if (apiType === "permitinyo") return await checkInyoPermit(recgovId);
    if (apiType === "permititinerary") return await checkItineraryPermit(recgovId);
    return await checkStandardPermit(recgovId);
  } catch (err) {
    console.error(`Fetch error for ${recgovId}:`, err);
    return { available: false, availableDates: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Load active watches
    const { data: watches, error: fetchError } = await supabase
      .from("active_watches")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!watches || watches.length === 0) {
      return new Response(JSON.stringify({ checked: 0, found: 0, message: "No active watches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load permit registry
    const { data: permitRegistry } = await supabase
      .from("park_permits")
      .select("name, park_id, recgov_permit_id, api_type")
      .eq("is_active", true);

    const permitLookup = new Map<string, { recgovId: string; apiType: string }>();
    for (const p of permitRegistry ?? []) {
      if (p.recgov_permit_id) {
        permitLookup.set(`${p.park_id}:${p.name}`, {
          recgovId: p.recgov_permit_id,
          apiType: p.api_type || "standard",
        });
      }
    }

    // 3. Group watches by permit
    const groups: Record<string, typeof watches> = {};
    for (const w of watches) {
      const key = `${w.park_id}:${w.permit_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    }

    let foundCount = 0;
    const results: Array<{
      watchId: string;
      permitName: string;
      parkId: string;
      found: boolean;
      cached?: boolean;
      availableDates?: string[];
      error?: string;
    }> = [];

    // 4. Process each permit group SEQUENTIALLY with cache-first logic
    for (const [key, groupWatches] of Object.entries(groups)) {
      const permit = permitLookup.get(key);
      if (!permit) {
        console.warn(`No recgov_permit_id for: ${key}`);
        for (const w of groupWatches) {
          results.push({ watchId: w.id, permitName: w.permit_name, parkId: w.park_id, found: false, error: "No Recreation.gov ID configured" });
        }
        continue;
      }

      // ── Cache-first: check if we have a fresh or stale cache entry ──
      const { data: cached } = await supabase
        .from("permit_cache")
        .select("*")
        .eq("cache_key", key)
        .maybeSingle();

      const now = new Date();
      let result: FetchResult;
      let usedCache = false;

      if (cached && new Date(cached.stale_at) > now) {
        // HOT CACHE: use cached result, skip API call entirely
        console.log(`🟢 Cache HIT (hot) for ${key}`);
        result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
        usedCache = true;
      } else if (cached && cached.error_count >= CIRCUIT_BREAKER_THRESHOLD) {
        // CIRCUIT BREAKER OPEN: too many consecutive failures
        const backoffMs = getBackoffMs(cached.error_count);
        const backoffUntil = new Date(new Date(cached.fetched_at).getTime() + backoffMs);
        if (now < backoffUntil) {
          console.log(`🔴 Circuit breaker OPEN for ${key} — backing off until ${backoffUntil.toISOString()}`);
          // Serve stale if available, otherwise report down
          if (new Date(cached.expires_at) > now) {
            result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
            usedCache = true;
          } else {
            result = { available: false, availableDates: [], error: "API temporarily unavailable (circuit breaker)" };
          }
        } else {
          // Backoff expired — try again
          console.log(`🟡 Circuit breaker HALF-OPEN for ${key} — retrying`);
          result = await fetchWithHealthLog(supabase, supabaseUrl, permit.recgovId, permit.apiType, key);
          await upsertCache(supabase, key, permit.recgovId, permit.apiType, result, cached?.error_count || 0);
        }
      } else {
        // STALE or NO CACHE: fetch from API
        console.log(`🟡 Cache ${cached ? "STALE" : "MISS"} for ${key} — fetching from API`);
        result = await fetchWithHealthLog(supabase, supabaseUrl, permit.recgovId, permit.apiType, key);
        await upsertCache(supabase, key, permit.recgovId, permit.apiType, result, cached?.error_count || 0);

        // If API failed but we have stale cache, fall back to it
        if (result.error && cached && new Date(cached.expires_at) > now) {
          console.log(`⚠️ API failed, falling back to stale cache for ${key}`);
          result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
          usedCache = true;
        }

        // Delay before next permit group to respect rate limits
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }

      // ── Process results for all watches in this group ──
      if (result.available) {
        const [findParkId, findPermitName] = key.split(":");
        const today = new Date().toISOString().split("T")[0];

        // Idempotent upsert — only one recent_finds entry per permit per day
        const { data: upserted } = await supabase
          .from("recent_finds")
          .upsert(
            {
              park_id: findParkId,
              permit_name: findPermitName,
              available_dates: result.availableDates ?? [],
              found_date: today,
            },
            { onConflict: "park_id,permit_name,found_date" }
          )
          .select("id")
          .maybeSingle();

        // Only increment find count if this is a new row (not a duplicate)
        if (upserted) {
          await supabase.rpc("increment_permit_finds", { p_park_id: findParkId, p_permit_name: findPermitName });
        }
      }

      for (const watch of groupWatches) {
        if (result.available) {
          console.log(`✅ Permit FOUND for user ${watch.user_id}: ${watch.permit_name} (${watch.park_id})`);

          // Load user profile for notification preferences
          const { data: profile } = await supabase
            .from("profiles")
            .select("phone_number, is_pro, notify_email, notify_sms")
            .eq("user_id", watch.user_id)
            .maybeSingle();

          let anyNotificationSucceeded = false;

          // SMS notification (requires Pro + phone + preference enabled)
          if (profile?.notify_sms && profile?.is_pro && profile?.phone_number) {
            try {
              const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
                body: JSON.stringify({ to: profile.phone_number, permitName: watch.permit_name, parkName: watch.park_id, availableDates: result.availableDates }),
              });
              const smsData = await smsRes.json();
              if (smsRes.ok && smsData.success) {
                anyNotificationSucceeded = true;
                console.log(`📱 SMS sent to Pro user ${watch.user_id}, SID: ${smsData.sid}`);
                await supabase.from("notification_log").insert({
                  watch_id: watch.id, user_id: watch.user_id, channel: "sms",
                  status: "sent", permit_name: watch.permit_name, park_id: watch.park_id,
                  available_dates: result.availableDates ?? [],
                });
              } else {
                const errMsg = smsData.error || `HTTP ${smsRes.status}`;
                console.error(`SMS failed for ${watch.user_id}: ${errMsg}`);
                await supabase.from("notification_log").insert({
                  watch_id: watch.id, user_id: watch.user_id, channel: "sms",
                  status: "failed", error_message: errMsg,
                  permit_name: watch.permit_name, park_id: watch.park_id,
                  available_dates: result.availableDates ?? [],
                  next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
                });
              }
            } catch (smsErr) {
              const errMsg = smsErr instanceof Error ? smsErr.message : "Unknown error";
              console.error(`SMS send error for ${watch.user_id}:`, errMsg);
              await supabase.from("notification_log").insert({
                watch_id: watch.id, user_id: watch.user_id, channel: "sms",
                status: "failed", error_message: errMsg,
                permit_name: watch.permit_name, park_id: watch.park_id,
                available_dates: result.availableDates ?? [],
                next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
              });
            }
          }

          // Email notification (respects user preference, defaults to true)
          if (profile?.notify_email !== false) {
            try {
              const { data: authData } = await supabase.auth.admin.getUserById(watch.user_id);
              const userEmail = authData?.user?.email;
              if (userEmail) {
                const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-permit-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
                  body: JSON.stringify({ to: userEmail, permitName: watch.permit_name, parkName: watch.park_id, availableDates: result.availableDates }),
                });
                const emailData = await emailRes.json();
                if (emailRes.ok && emailData.success) {
                  anyNotificationSucceeded = true;
                  console.log(`📧 Email sent to ${watch.user_id}, ID: ${emailData.id}`);
                  await supabase.from("notification_log").insert({
                    watch_id: watch.id, user_id: watch.user_id, channel: "email",
                    status: "sent", permit_name: watch.permit_name, park_id: watch.park_id,
                    available_dates: result.availableDates ?? [],
                  });
                } else {
                  const errMsg = emailData.error || `HTTP ${emailRes.status}`;
                  console.error(`Email failed for ${watch.user_id}: ${errMsg}`);
                  await supabase.from("notification_log").insert({
                    watch_id: watch.id, user_id: watch.user_id, channel: "email",
                    status: "failed", error_message: errMsg,
                    permit_name: watch.permit_name, park_id: watch.park_id,
                    available_dates: result.availableDates ?? [],
                    next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
                  });
                }
              }
            } catch (emailErr) {
              const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error";
              console.error(`Email send error for ${watch.user_id}:`, errMsg);
              await supabase.from("notification_log").insert({
                watch_id: watch.id, user_id: watch.user_id, channel: "email",
                status: "failed", error_message: errMsg,
                permit_name: watch.permit_name, park_id: watch.park_id,
                available_dates: result.availableDates ?? [],
                next_retry_at: new Date(Date.now() + 2 * 60_000).toISOString(),
              });
            }
          }

          // Only deactivate the watch if at least one notification was delivered
          if (anyNotificationSucceeded) {
            foundCount++;
            await supabase.from("active_watches").update({ status: "found", is_active: false }).eq("id", watch.id);
            console.log(`🔒 Watch ${watch.id} deactivated after successful notification`);
          } else {
            console.warn(`⚠️ Watch ${watch.id} kept ACTIVE — all notifications failed, will retry next cycle`);
          }
        }
        results.push({
          watchId: watch.id,
          permitName: watch.permit_name,
          parkId: watch.park_id,
          found: result.available,
          cached: usedCache,
          availableDates: result.available ? result.availableDates : undefined,
          error: result.error,
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: watches.length, found: foundCount, results, polledAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-permits error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helper: fetch + log health ──────────────────────────────────────────────

async function fetchWithHealthLog(
  supabase: any,
  supabaseUrl: string,
  recgovId: string,
  apiType: string,
  cacheKey: string
): Promise<FetchResult> {
  const start = Date.now();
  const result = await fetchPermitFromApi(recgovId, apiType);
  const elapsed = Date.now() - start;

  // Log API health (fire-and-forget)
  supabase.from("api_health_log").insert({
    endpoint: `${apiType}/${recgovId}`,
    status_code: result.statusCode ?? null,
    response_time_ms: elapsed,
    error_message: result.error ?? null,
  }).then(() => {});

  return result;
}

// ─── Helper: upsert cache ────────────────────────────────────────────────────

async function upsertCache(
  supabase: any,
  cacheKey: string,
  recgovId: string,
  apiType: string,
  result: FetchResult,
  prevErrorCount: number
) {
  const now = new Date();
  const isError = !!result.error;
  const errorCount = isError ? prevErrorCount + 1 : 0;

  await supabase.from("permit_cache").upsert(
    {
      cache_key: cacheKey,
      recgov_id: recgovId,
      api_type: apiType,
      available: result.available,
      available_dates: result.availableDates,
      fetched_at: now.toISOString(),
      stale_at: new Date(now.getTime() + CACHE_HOT_TTL_MINUTES * 60_000).toISOString(),
      expires_at: new Date(now.getTime() + CACHE_STALE_TTL_HOURS * 3600_000).toISOString(),
      error_count: errorCount,
      last_error: result.error ?? null,
      last_status_code: result.statusCode ?? null,
    },
    { onConflict: "cache_key" }
  );
}
