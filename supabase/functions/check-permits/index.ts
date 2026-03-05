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
const MAX_BACKOFF_MS = 900_000; // 15 minutes
const CIRCUIT_BREAKER_THRESHOLD = 3;
const MAX_PERMITS_PER_INVOCATION = 10;
const GLOBAL_RATE_LIMIT_KEY = "__global_rate_limit__";
const GLOBAL_RATE_LIMIT_BACKOFF_MS = 600_000; // 10 minutes

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

  // ── CRON_SECRET auth guard (also accepts service role key for admin invocations) ──
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronSecret && token !== serviceRoleKeyAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 0. Check global rate-limit circuit breaker
    const { data: globalBreaker } = await supabase
      .from("permit_cache")
      .select("fetched_at, error_count")
      .eq("cache_key", GLOBAL_RATE_LIMIT_KEY)
      .maybeSingle();

    if (globalBreaker && globalBreaker.error_count > 0) {
      const breakerExpires = new Date(new Date(globalBreaker.fetched_at).getTime() + GLOBAL_RATE_LIMIT_BACKOFF_MS);
      if (new Date() < breakerExpires) {
        const remainingSec = Math.round((breakerExpires.getTime() - Date.now()) / 1000);
        console.log(`🛑 Global rate-limit circuit breaker OPEN — skipping all checks. Resumes in ${remainingSec}s`);
        return new Response(JSON.stringify({
          checked: 0, found: 0,
          message: `Global rate-limit backoff active. Resumes in ${remainingSec}s`,
          breakerExpiresAt: breakerExpires.toISOString(),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        // Backoff expired — reset the breaker
        console.log(`🟢 Global rate-limit backoff expired — resuming checks`);
        await supabase.from("permit_cache").update({ error_count: 0 }).eq("cache_key", GLOBAL_RATE_LIMIT_KEY);
      }
    }

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

    // 2b. Load park names for detection logging
    const { data: parkRows } = await supabase.from("parks").select("id, name");
    const parkNameLookup = new Map<string, string>();
    for (const p of parkRows ?? []) {
      parkNameLookup.set(p.id, p.name);
    }

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

    // 4. Process each permit group SEQUENTIALLY with cache-first logic (batch-limited)
    const permitGroups = Object.entries(groups);
    let processedCount = 0;

    let globalRateLimited = false;

    for (const [key, groupWatches] of permitGroups) {
      if (globalRateLimited) {
        console.log(`🛑 Global 429 — skipping remaining permit: ${key}`);
        for (const w of groupWatches) {
          results.push({ watchId: w.id, permitName: w.permit_name, parkId: w.park_id, found: false, error: "Skipped: global rate limit" });
        }
        continue;
      }
      if (processedCount >= MAX_PERMITS_PER_INVOCATION) {
        console.log(`⏸ Batch limit reached (${MAX_PERMITS_PER_INVOCATION}). Remaining ${permitGroups.length - processedCount} permits deferred to next cycle.`);
        break;
      }
      processedCount++;
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
          if (result.statusCode === 429) {
            globalRateLimited = true;
            await tripGlobalRateLimit(supabase);
          }
        }
      } else {
        // STALE or NO CACHE: fetch from API
        console.log(`🟡 Cache ${cached ? "STALE" : "MISS"} for ${key} — fetching from API`);
        result = await fetchWithHealthLog(supabase, supabaseUrl, permit.recgovId, permit.apiType, key);
        await upsertCache(supabase, key, permit.recgovId, permit.apiType, result, cached?.error_count || 0);

        // Global 429 trip
        if (result.statusCode === 429) {
          globalRateLimited = true;
          await tripGlobalRateLimit(supabase);
        }

        // If API failed but we have stale cache, fall back to it
        if (result.error && cached && new Date(cached.expires_at) > now) {
          console.log(`⚠️ API failed, falling back to stale cache for ${key}`);
          result = { available: cached.available, availableDates: cached.available_dates || [], statusCode: 200 };
          usedCache = true;
        }

        // Delay before next permit group to respect rate limits
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }

      // ── Upsert into permit_availability for app reads ──
      if (result.available && result.availableDates?.length) {
        const [findParkId, findPermitName] = key.split(":");
        await upsertPermitAvailability(supabase, findParkId, findPermitName, result.availableDates);
      }

      // ── Process results for all watches in this group ──
      if (result.available) {
        const [findParkId, findPermitName] = key.split(":");

        // Consolidated: upserts recent_finds + increments total_finds only if new row
        await supabase.rpc("increment_permit_finds", { p_park_id: findParkId, p_permit_name: findPermitName });

        // Update available_dates + new columns on the (possibly just-inserted) row
        const today = new Date().toISOString().split("T")[0];
        await supabase
          .from("recent_finds")
          .update({
            available_dates: result.availableDates ?? [],
            location_name: parkNameLookup.get(findParkId) ?? findParkId,
            source: "recreation.gov",
          })
          .eq("park_id", findParkId)
          .eq("permit_name", findPermitName)
          .eq("found_date", today);
      }

      // ── Enqueue notifications instead of sending inline ──
      const queueInserts: Array<{
        watch_id: string;
        user_id: string;
        park_id: string;
        permit_name: string;
        available_dates: string[];
      }> = [];

      for (const watch of groupWatches) {
        if (result.available) {
          // Duplicate notification guard: skip if notified within last 30 minutes
          const NOTIFICATION_COOLDOWN_MS = 30 * 60_000;
          if (watch.last_notified_at && (now.getTime() - new Date(watch.last_notified_at).getTime()) < NOTIFICATION_COOLDOWN_MS) {
            console.log(`⏭ Skipping watch ${watch.id} — notified ${Math.round((now.getTime() - new Date(watch.last_notified_at).getTime()) / 60_000)}m ago`);
            results.push({ watchId: watch.id, permitName: watch.permit_name, parkId: watch.park_id, found: true, cached: usedCache, availableDates: result.availableDates, error: "Skipped: cooldown" });
            continue;
          }

          console.log(`✅ Permit FOUND for user ${watch.user_id}: ${watch.permit_name} (${watch.park_id}) — enqueuing notification`);
          queueInserts.push({
            watch_id: watch.id,
            user_id: watch.user_id,
            park_id: watch.park_id,
            permit_name: watch.permit_name,
            available_dates: result.availableDates ?? [],
          });
          foundCount++;
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

      // Batch-insert all queued notifications for this permit group
      if (queueInserts.length > 0) {
        const { error: queueErr } = await supabase
          .from("notification_queue")
          .insert(queueInserts);
        if (queueErr) {
          console.error(`Queue insert error for ${key}:`, queueErr.message);
        } else {
          console.log(`📬 Enqueued ${queueInserts.length} notifications for ${key}`);

          // Stamp last_notified_at immediately to prevent duplicate enqueues on next cycle
          const enqueuedWatchIds = queueInserts.map((q) => q.watch_id);
          const { error: stampErr } = await supabase
            .from("active_watches")
            .update({ last_notified_at: new Date().toISOString() })
            .in("id", enqueuedWatchIds);
          if (stampErr) {
            console.error(`Failed to stamp last_notified_at for ${key}:`, stampErr.message);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ checked: watches.length, found: foundCount, globalRateLimited, results, polledAt: new Date().toISOString() }),
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

// ─── Helper: upsert permit_availability rows ────────────────────────────────

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
    date: d.split("T")[0], // normalise to YYYY-MM-DD
    available_spots: 1, // Recreation.gov doesn't always give exact counts; 1 = "available"
    last_checked: now,
  }));

  const { error } = await supabase
    .from("permit_availability")
    .upsert(rows, { onConflict: "park_code,permit_type,date" });

  if (error) {
    console.error(`permit_availability upsert error:`, error.message);
  } else {
    console.log(`📊 Upserted ${rows.length} permit_availability rows for ${parkId}:${permitName}`);
  }
}

// ─── Helper: trip global rate-limit circuit breaker ──────────────────────────

async function tripGlobalRateLimit(supabase: any) {
  console.error(`🛑 429 received from Recreation.gov — tripping global rate-limit circuit breaker for ${GLOBAL_RATE_LIMIT_BACKOFF_MS / 1000}s`);
  await supabase.from("permit_cache").upsert(
    {
      cache_key: GLOBAL_RATE_LIMIT_KEY,
      recgov_id: "global",
      api_type: "global",
      available: false,
      available_dates: [],
      fetched_at: new Date().toISOString(),
      stale_at: new Date(Date.now() + GLOBAL_RATE_LIMIT_BACKOFF_MS).toISOString(),
      expires_at: new Date(Date.now() + GLOBAL_RATE_LIMIT_BACKOFF_MS).toISOString(),
      error_count: 1,
      last_error: "Global rate limit (429)",
      last_status_code: 429,
    },
    { onConflict: "cache_key" }
  );
}
