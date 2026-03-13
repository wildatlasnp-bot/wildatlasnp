import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const RECGOV_HEADERS = {
  "User-Agent": "WildAtlas/1.0 (permit-availability-checker)",
  Accept: "application/json",
};

const DELAY_BETWEEN_REQUESTS_MS = 500;
const CACHE_HOT_TTL_MINUTES = 5;
const CACHE_STALE_TTL_HOURS = 24;
const MAX_BACKOFF_MS = 900_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const NOTIFICATION_COOLDOWN_MS = 30 * 60_000;
const ENDPOINT_BREAKER_DEFAULT_COOLDOWN_S = 600; // 10 min; overridden by Retry-After if present

function endpointKeyFromApiType(apiType: string): string {
  if (apiType === "permitinyo") return "permitinyo";
  if (apiType === "permititinerary") return "permititinerary";
  return "permits";
}

interface EndpointBreakerState {
  effectiveState: "closed" | "open" | "half_open";
  cooldownUntil: string | null;
}

async function getEndpointBreakerState(supabase: any, endpointKey: string): Promise<EndpointBreakerState> {
  const { data } = await supabase
    .from("endpoint_circuit_breakers")
    .select("state, cooldown_until")
    .eq("endpoint_key", endpointKey)
    .maybeSingle();

  if (!data || data.state === "closed") return { effectiveState: "closed", cooldownUntil: null };

  const cooldownUntil = data.cooldown_until ? new Date(data.cooldown_until) : null;
  if (cooldownUntil && new Date() >= cooldownUntil) {
    return { effectiveState: "half_open", cooldownUntil: data.cooldown_until };
  }
  return { effectiveState: "open", cooldownUntil: data.cooldown_until };
}

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
  retryAfterSeconds?: number;
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

    const res = await fetch(url, { headers: RECGOV_HEADERS, signal: AbortSignal.timeout(8000) });
    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      return { available: false, availableDates: [], statusCode: 429, error: "Rate limited", retryAfterSeconds: ra ? parseInt(ra, 10) : undefined };
    }
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

    const res = await fetch(url, { headers: RECGOV_HEADERS, signal: AbortSignal.timeout(8000) });
    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      return { available: false, availableDates: [], statusCode: 429, error: "Rate limited", retryAfterSeconds: ra ? parseInt(ra, 10) : undefined };
    }
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
  const contentRes = await fetch(contentUrl, { headers: RECGOV_HEADERS, signal: AbortSignal.timeout(8000) });
  if (contentRes.status === 429) {
    const ra = contentRes.headers.get("Retry-After");
    return { available: false, availableDates: [], statusCode: 429, error: "Rate limited", retryAfterSeconds: ra ? parseInt(ra, 10) : undefined };
  }
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
      const res = await fetch(url, { headers: RECGOV_HEADERS, signal: AbortSignal.timeout(8000) });
      if (res.status === 429) {
        const ra = res.headers.get("Retry-After");
        return { available: availableDates.length > 0, availableDates: [...new Set(availableDates)].slice(0, 10), statusCode: 429, error: "Rate limited", retryAfterSeconds: ra ? parseInt(ra, 10) : undefined };
      }
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
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    if (isTimeout) {
      console.error(`Upstream timeout (8s) for ${recgovId} [${apiType}] — treating as failed check`);
      return { available: false, availableDates: [], error: "Upstream timeout" };
    }
    console.error(`Fetch error for ${recgovId}:`, err);
    return { available: false, availableDates: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";

  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      scanTargetId,   // UUID of the scan_target
      permitKey,      // "parkId:permitName"
      recgovId,       // Recreation.gov permit ID
      apiType,        // "standard" | "permitinyo" | "permititinerary"
      parkName,       // Human-readable park name
      watchers,       // Array of user_watchers for this scan target
    } = body;

    if (!permitKey || !recgovId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: permitKey, recgovId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`🔍 Worker processing scan target: ${permitKey} (${watchers?.length ?? 0} watchers)`);

    // ── Per-endpoint circuit breaker check (before any fetch) ──
    const endpointKey = endpointKeyFromApiType(apiType);
    const breakerState = await getEndpointBreakerState(supabase, endpointKey);

    let endpointCircuitOpen = false;

    if (breakerState.effectiveState === "open") {
      console.log(`🔴 Endpoint circuit OPEN [${endpointKey}] — skipping fetch for ${permitKey} (cooldown until ${breakerState.cooldownUntil})`);
      endpointCircuitOpen = true;
      // Use stale cache if available to keep the UI populated
      const { data: cachedForOpen } = await supabase
        .from("permit_cache").select("*").eq("cache_key", permitKey).maybeSingle();
      const openResult = (cachedForOpen && new Date(cachedForOpen.expires_at) > new Date())
        ? { available: cachedForOpen.available, availableDates: cachedForOpen.available_dates || [], statusCode: 200 }
        : { available: false, availableDates: [], error: `Endpoint [${endpointKey}] circuit open — no usable cache` };
      return new Response(JSON.stringify({
        permitKey, found: 0, available: openResult.available, cached: !!cachedForOpen,
        rateLimited: false, endpointCircuitOpen: true, cooldownUntil: breakerState.cooldownUntil,
        watchersProcessed: watchers?.length ?? 0, enqueued: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (breakerState.effectiveState === "half_open") {
      console.log(`🟡 Endpoint circuit HALF-OPEN [${endpointKey}] — attempting probe for ${permitKey}`);
    }

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

      if (result.statusCode === 429) {
        rateLimited = true;
        // Update per-endpoint circuit breaker (atomic RPC with FOR UPDATE)
        const cooldownSeconds = (result.retryAfterSeconds && result.retryAfterSeconds > 0)
          ? Math.max(result.retryAfterSeconds, ENDPOINT_BREAKER_DEFAULT_COOLDOWN_S)
          : ENDPOINT_BREAKER_DEFAULT_COOLDOWN_S;
        const { data: breakerUpdate } = await supabase.rpc("record_endpoint_429", {
          p_endpoint_key: endpointKey,
          p_cooldown_seconds: cooldownSeconds,
        });
        if (breakerUpdate?.length) {
          const bu = breakerUpdate[0];
          if (bu.prev_state === "closed" && bu.new_state === "open") {
            console.error(`🔴 Endpoint circuit [${endpointKey}]: closed → open after ${bu.new_count} consecutive 429s (cooldown until ${bu.cooldown_until})`);
          } else if (bu.prev_state === "open" && bu.new_state === "open") {
            console.error(`🔴 Endpoint circuit [${endpointKey}]: still open — cooldown reset (${bu.new_count} total 429s, until ${bu.cooldown_until})`);
          } else if (breakerState.effectiveState === "half_open") {
            console.error(`🔴 Endpoint circuit [${endpointKey}]: half-open → reopened (probe got 429; cooldown until ${bu.cooldown_until})`);
          }
        }
      } else if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
        // Success: close the circuit if it was open/half-open (5xx and network errors leave state unchanged)
        if (breakerState.effectiveState === "half_open") {
          const { data: closeResult } = await supabase.rpc("record_endpoint_success", { p_endpoint_key: endpointKey });
          if (closeResult?.length && closeResult[0].prev_state === "open") {
            console.log(`🟢 Endpoint circuit [${endpointKey}]: half-open → closed (probe succeeded)`);
          }
        }
      }

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

    // ── Match watchers & enqueue notifications ──
    let foundCount = 0;

    if (result.available && watchers?.length) {
      const [findParkId, findPermitName] = permitKey.split(":");

      // Generate event fingerprint for dedup — stable per park/permit/day,
      // intentionally excludes the available date list so that slot changes
      // within the same day do not create new fingerprints and re-notify.
      const today = new Date().toISOString().split("T")[0];
      const fingerprint = `${findParkId}:${findPermitName}:${today}`;

      // Atomically claim the fingerprint via INSERT; the UNIQUE constraint on
      // event_fingerprint acts as the concurrency fence (no read-check needed).
      const { error: recentFindsErr } = await supabase
        .from("recent_finds")
        .insert({
          park_id: findParkId,
          permit_name: findPermitName,
          found_date: today,
          available_dates: result.availableDates ?? [],
          location_name: parkName ?? findParkId,
          source: "recreation.gov",
          event_fingerprint: fingerprint,
          available_count: result.availableDates?.length ?? 0,
        });

      if (recentFindsErr) {
        if (recentFindsErr.code === "23505") {
          // Another worker already claimed this fingerprint — skip notifications.
          console.log(`⏭ Fingerprint race — already claimed by another worker: ${fingerprint}`);
        } else {
          // Dedupe fence failed to persist for an unknown reason — fail closed.
          // Do not queue notifications without a confirmed fence.
          console.error(`recent_finds insert failed for ${fingerprint} (code: ${recentFindsErr.code}):`, recentFindsErr.message);
        }
        return new Response(
          JSON.stringify({ permitKey, found: 0, available: result.available, cached: usedCache, rateLimited, endpointCircuitOpen, watchersProcessed: 0, enqueued: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.rpc("increment_permit_finds", { p_park_id: findParkId, p_permit_name: findPermitName });
      console.log(`📝 New detection logged: ${fingerprint}`);

      // Capture each candidate watcher's current last_notified_at before
      // stamping so we can restore the exact prior value if the queue insert
      // later fails.  This read happens inside the same request context as the
      // stamp UPDATE below; the watcher IDs are a small, bounded set, so the
      // extra round-trip is negligible.
      const candidateIds = (watchers as any[]).map((w: any) => w.id);
      const { data: priorSnapshots, error: snapshotErr } = await supabase
        .from("user_watchers")
        .select("id, last_notified_at")
        .in("id", candidateIds);

      if (snapshotErr) {
        console.error(`Prior snapshot read failed for ${permitKey}:`, snapshotErr.message);
        return new Response(
          JSON.stringify({ permitKey, found: 0, available: result.available, cached: usedCache, rateLimited, endpointCircuitOpen, watchersProcessed: watchers?.length ?? 0, enqueued: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Index prior values by watcher id for O(1) lookup during rollback.
      const priorByid = new Map<string, string | null>(
        (priorSnapshots ?? []).map((r: any) => [r.id, r.last_notified_at ?? null])
      );

      // Atomically claim the notification cooldown for all eligible watchers.
      //
      // A single UPDATE stamps last_notified_at and returns only the rows
      // where the cooldown had actually elapsed (last_notified_at IS NULL or
      // older than NOTIFICATION_COOLDOWN_MS).  PostgreSQL re-evaluates the
      // WHERE clause after acquiring the row-level lock, so a concurrent
      // worker that holds the same watcher snapshot will find the row already
      // stamped and update 0 rows — preventing duplicate queue inserts even
      // when multiple check-single-permit workers run in parallel.
      const stampTime = new Date();
      const cooldownThreshold = new Date(stampTime.getTime() - NOTIFICATION_COOLDOWN_MS).toISOString();
      const stampIso = stampTime.toISOString();
      const { data: claimedWatchers, error: claimErr } = await supabase
        .from("user_watchers")
        .update({ last_notified_at: stampIso })
        .in("id", candidateIds)
        .or(`last_notified_at.is.null,last_notified_at.lt.${cooldownThreshold}`)
        .select("id, user_id");

      if (claimErr) {
        console.error(`Cooldown claim failed for ${permitKey}:`, claimErr.message);
        return new Response(
          JSON.stringify({ permitKey, found: 0, available: result.available, cached: usedCache, rateLimited, endpointCircuitOpen, watchersProcessed: watchers?.length ?? 0, enqueued: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const skippedByCooldown = (watchers?.length ?? 0) - (claimedWatchers?.length ?? 0);
      if (skippedByCooldown > 0) {
        console.log(`⏭ ${skippedByCooldown} watcher(s) skipped — cooldown not yet elapsed`);
      }

      const queueInserts = (claimedWatchers ?? []).map((w: any) => ({
        watch_id: w.id,
        user_id: w.user_id,
        park_id: findParkId,
        permit_name: findPermitName,
        available_dates: result.availableDates ?? [],
      }));

      foundCount = queueInserts.length;

      if (queueInserts.length > 0) {
        console.log(`✅ Permit FOUND for ${queueInserts.length} watcher(s): ${findPermitName} — enqueuing`);
        const { error: queueErr } = await supabase
          .from("notification_queue")
          .insert(queueInserts);
        if (queueErr) {
          console.error(`Queue insert error for ${permitKey}:`, queueErr.message);

          // Restore each watcher's exact prior last_notified_at value.
          // Only overwrite rows still holding this invocation's stampIso to
          // avoid clobbering a newer timestamp written by another worker after
          // the claim above.  Each watcher may have a distinct prior value
          // (including null), so updates are issued per-watcher.
          const rollbackPromises = (claimedWatchers ?? []).map((w: any) => {
            const prior = priorByid.get(w.id) ?? null;
            return supabase
              .from("user_watchers")
              .update({ last_notified_at: prior })
              .eq("id", w.id)
              .eq("last_notified_at", stampIso); // guard: skip if already overwritten
          });
          await Promise.all(rollbackPromises);
          console.log(`↩️ Rolled back last_notified_at to prior values after queue failure`);
          foundCount = 0;
        } else {
          console.log(`📬 Enqueued ${queueInserts.length} notifications for ${permitKey}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        permitKey,
        found: foundCount,
        available: result.available,
        cached: usedCache,
        rateLimited,
        endpointCircuitOpen,
        watchersProcessed: watchers?.length ?? 0,
        enqueued: foundCount,
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
