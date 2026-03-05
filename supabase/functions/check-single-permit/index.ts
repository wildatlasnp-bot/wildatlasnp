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

const DELAY_BETWEEN_REQUESTS_MS = 500; // v2 - fan-out worker
const CACHE_HOT_TTL_MINUTES = 5;
const CACHE_STALE_TTL_HOURS = 24;
const MAX_BACKOFF_MS = 900_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const NOTIFICATION_COOLDOWN_MS = 30 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getBackoffMs(errorCount: number): number {
  const base = Math.min(30_000 * Math.pow(2, errorCount - 1), MAX_BACKOFF_MS);
  return base + Math.random() * base * 0.3;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

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

  // Auth guard: service role key only (called internally by orchestrator)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      permitKey,      // "parkId:permitName"
      recgovId,       // Recreation.gov permit ID
      apiType,        // "standard" | "permitinyo" | "permititinerary"
      parkName,       // Human-readable park name for logging
      watches,        // Array of watches for this permit group
    } = body;

    if (!permitKey || !recgovId || !watches?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: permitKey, recgovId, watches" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`🔍 Worker processing permit: ${permitKey} (${watches.length} watches)`);

    // ── Cache-first logic ──
    const { data: cached } = await supabase
      .from("permit_cache")
      .select("*")
      .eq("cache_key", permitKey)
      .maybeSingle();

    const now = new Date();
    let result: FetchResult;
    let usedCache = false;
    let rateLimited = false;

    if (cached && new Date(cached.stale_at) > now) {
      console.log(`🟢 Cache HIT (hot) for ${permitKey}`);
      result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
      usedCache = true;
    } else if (cached && cached.error_count >= CIRCUIT_BREAKER_THRESHOLD) {
      const backoffMs = getBackoffMs(cached.error_count);
      const backoffUntil = new Date(new Date(cached.fetched_at).getTime() + backoffMs);
      if (now < backoffUntil) {
        console.log(`🔴 Circuit breaker OPEN for ${permitKey}`);
        if (new Date(cached.expires_at) > now) {
          result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
          usedCache = true;
        } else {
          result = { available: false, availableDates: [], error: "API temporarily unavailable (circuit breaker)" };
        }
      } else {
        console.log(`🟡 Circuit breaker HALF-OPEN for ${permitKey}`);
        result = await fetchWithHealthLog(supabase, supabaseUrl, recgovId, apiType, permitKey);
        await upsertCache(supabase, permitKey, recgovId, apiType, result, cached?.error_count || 0);
        if (result.statusCode === 429) rateLimited = true;
      }
    } else {
      console.log(`🟡 Cache ${cached ? "STALE" : "MISS"} for ${permitKey}`);
      result = await fetchWithHealthLog(supabase, supabaseUrl, recgovId, apiType, permitKey);
      await upsertCache(supabase, permitKey, recgovId, apiType, result, cached?.error_count || 0);

      if (result.statusCode === 429) rateLimited = true;

      if (result.error && cached && new Date(cached.expires_at) > now) {
        console.log(`⚠️ API failed, falling back to stale cache for ${permitKey}`);
        result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
        usedCache = true;
      }
    }

    // ── Upsert permit_availability ──
    if (result.available && result.availableDates?.length) {
      const [findParkId, findPermitName] = permitKey.split(":");
      await upsertPermitAvailability(supabase, findParkId, findPermitName, result.availableDates);
    }

    // ── Match watches & enqueue notifications ──
    let foundCount = 0;
    const queueInserts: Array<{
      watch_id: string;
      user_id: string;
      park_id: string;
      permit_name: string;
      available_dates: string[];
    }> = [];

    if (result.available) {
      const [findParkId, findPermitName] = permitKey.split(":");

      // Record the find
      await supabase.rpc("increment_permit_finds", { p_park_id: findParkId, p_permit_name: findPermitName });
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("recent_finds")
        .update({
          available_dates: result.availableDates ?? [],
          location_name: parkName ?? findParkId,
          source: "recreation.gov",
        })
        .eq("park_id", findParkId)
        .eq("permit_name", findPermitName)
        .eq("found_date", today);

      for (const watch of watches) {
        if (watch.last_notified_at && (now.getTime() - new Date(watch.last_notified_at).getTime()) < NOTIFICATION_COOLDOWN_MS) {
          console.log(`⏭ Skipping watch ${watch.id} — cooldown`);
          continue;
        }

        console.log(`✅ Permit FOUND for user ${watch.user_id}: ${watch.permit_name} — enqueuing`);
        queueInserts.push({
          watch_id: watch.id,
          user_id: watch.user_id,
          park_id: watch.park_id,
          permit_name: watch.permit_name,
          available_dates: result.availableDates ?? [],
        });
        foundCount++;
      }
    }

    // Batch enqueue with stamp-before-insert pattern
    if (queueInserts.length > 0) {
      const enqueuedWatchIds = queueInserts.map((q) => q.watch_id);
      const stampTime = new Date().toISOString();
      const { error: stampErr } = await supabase
        .from("active_watches")
        .update({ last_notified_at: stampTime })
        .in("id", enqueuedWatchIds);
      if (stampErr) {
        console.error(`Failed to stamp last_notified_at for ${permitKey}:`, stampErr.message);
      }

      const { error: queueErr } = await supabase
        .from("notification_queue")
        .insert(queueInserts);
      if (queueErr) {
        console.error(`Queue insert error for ${permitKey}:`, queueErr.message);
        await supabase
          .from("active_watches")
          .update({ last_notified_at: null })
          .in("id", enqueuedWatchIds);
        console.log(`↩️ Rolled back last_notified_at after queue failure`);
      } else {
        console.log(`📬 Enqueued ${queueInserts.length} notifications for ${permitKey}`);
      }
    }

    return new Response(
      JSON.stringify({
        permitKey,
        found: foundCount,
        available: result.available,
        cached: usedCache,
        rateLimited,
        watchesProcessed: watches.length,
        enqueued: queueInserts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-single-permit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  supabase.from("api_health_log").insert({
    endpoint: `${apiType}/${recgovId}`,
    status_code: result.statusCode ?? null,
    response_time_ms: elapsed,
    error_message: result.error ?? null,
  }).then(() => {});

  return result;
}

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

async function upsertPermitAvailability(
  supabase: any,
  parkId: string,
  permitName: string,
  availableDates: string[]
) {
  if (availableDates.length === 0) return;
  const now = new Date().toISOString();
  const rows = availableDates.map((d) => ({
    park_code: parkId,
    permit_type: permitName,
    date: d.split("T")[0],
    available_spots: 1,
    last_checked: now,
  }));

  const { error } = await supabase
    .from("permit_availability")
    .upsert(rows, { onConflict: "park_code,permit_type,date" });

  if (error) {
    console.error(`permit_availability upsert error:`, error.message);
  }
}
