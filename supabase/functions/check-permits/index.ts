import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GLOBAL_RATE_LIMIT_KEY = "__global_rate_limit__";
const GLOBAL_RATE_LIMIT_BACKOFF_MS = 600_000; // 10 minutes
const MAX_CONCURRENT_WORKERS = 5;

// ─── Main orchestrator ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth guard ──
  console.log("🔑 check-permits handler invoked");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";
  console.log(`🔑 cronSecret len=${cronSecret?.length}, token len=${token.length}, srkLen=${serviceRoleKey?.length}`);
  console.log(`🔑 cronSecret prefix=${cronSecret?.slice(0,8)}, token prefix=${token.slice(0,8)}`);
  console.log(`🔑 match cron=${token === cronSecret}, match srk=${token === serviceRoleKey}`);
  if (cronSecret) {
    if (token !== cronSecret && token !== serviceRoleKey) {
      console.log("🔑 Auth REJECTED");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("🔑 Auth PASSED");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
        console.log(`🛑 Global rate-limit circuit breaker OPEN. Resumes in ${remainingSec}s`);
        return new Response(JSON.stringify({
          checked: 0, dispatched: 0,
          message: `Global rate-limit backoff active. Resumes in ${remainingSec}s`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        console.log(`🟢 Global rate-limit backoff expired — resuming`);
        await supabase.from("permit_cache").update({ error_count: 0 }).eq("cache_key", GLOBAL_RATE_LIMIT_KEY);
      }
    }

    // 1. Load active watches (paginated)
    const PAGE_SIZE = 500;
    const watches: any[] = [];
    let page = 0;
    while (true) {
      const { data: batch, error: fetchError } = await supabase
        .from("active_watches")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (fetchError) throw fetchError;
      if (!batch || batch.length === 0) break;
      watches.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    if (watches.length === 0) {
      return new Response(JSON.stringify({ checked: 0, dispatched: 0, message: "No active watches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`📋 Loaded ${watches.length} active watches across ${page + 1} page(s)`);

    // 2. Load permit registry
    const { data: permitRegistry } = await supabase
      .from("park_permits")
      .select("name, park_id, recgov_permit_id, api_type")
      .eq("is_active", true);

    const { data: parkRows } = await supabase.from("parks").select("id, name");
    const parkNameLookup = new Map<string, string>();
    for (const p of parkRows ?? []) parkNameLookup.set(p.id, p.name);

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
    const groups: Record<string, any[]> = {};
    for (const w of watches) {
      const key = `${w.park_id}:${w.permit_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    }

    // 4. Build worker payloads
    const workerPayloads: Array<{
      permitKey: string;
      recgovId: string;
      apiType: string;
      parkName: string;
      watches: any[];
    }> = [];

    for (const [key, groupWatches] of Object.entries(groups)) {
      const permit = permitLookup.get(key);
      if (!permit) {
        console.warn(`No recgov_permit_id for: ${key} — skipping ${groupWatches.length} watches`);
        continue;
      }
      const [parkId] = key.split(":");
      workerPayloads.push({
        permitKey: key,
        recgovId: permit.recgovId,
        apiType: permit.apiType,
        parkName: parkNameLookup.get(parkId) ?? parkId,
        watches: groupWatches,
      });
    }

    console.log(`🚀 Dispatching ${workerPayloads.length} permit workers (max ${MAX_CONCURRENT_WORKERS} concurrent)`);

    // 5. Fan out to check-single-permit workers with concurrency limit
    const workerUrl = `${supabaseUrl}/functions/v1/check-single-permit`;
    const workerResults: Array<{ permitKey: string; result?: any; error?: string }> = [];

    // Process in batches of MAX_CONCURRENT_WORKERS
    for (let i = 0; i < workerPayloads.length; i += MAX_CONCURRENT_WORKERS) {
      const batch = workerPayloads.slice(i, i + MAX_CONCURRENT_WORKERS);

      const batchResults = await Promise.allSettled(
        batch.map(async (payload) => {
          try {
            const res = await fetch(workerUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
              return { permitKey: payload.permitKey, error: data.error || `HTTP ${res.status}` };
            }

            // If worker reported rate limiting, trip global breaker
            if (data.rateLimited) {
              console.error(`🛑 Worker reported 429 for ${payload.permitKey} — tripping global breaker`);
              await tripGlobalRateLimit(supabase);
            }

            return { permitKey: payload.permitKey, result: data };
          } catch (err) {
            return {
              permitKey: payload.permitKey,
              error: err instanceof Error ? err.message : "Worker invocation failed",
            };
          }
        })
      );

      for (const settled of batchResults) {
        if (settled.status === "fulfilled") {
          workerResults.push(settled.value);
          // Stop dispatching if we hit a global rate limit
          if (settled.value.result?.rateLimited) {
            console.log(`🛑 Global rate limit detected — stopping further dispatches`);
            i = workerPayloads.length; // break outer loop
            break;
          }
        } else {
          workerResults.push({ permitKey: "unknown", error: String(settled.reason) });
        }
      }
    }

    const totalFound = workerResults.reduce((sum, r) => sum + (r.result?.found || 0), 0);
    const totalEnqueued = workerResults.reduce((sum, r) => sum + (r.result?.enqueued || 0), 0);
    const errors = workerResults.filter((r) => r.error);

    console.log(`✅ Orchestrator complete: ${workerResults.length} permits processed, ${totalFound} found, ${totalEnqueued} enqueued, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        checked: watches.length,
        dispatched: workerPayloads.length,
        completed: workerResults.length,
        found: totalFound,
        enqueued: totalEnqueued,
        errors: errors.length,
        workerResults,
        polledAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-permits orchestrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helper: trip global rate-limit circuit breaker ──────────────────────────

async function tripGlobalRateLimit(supabase: any) {
  console.error(`🛑 Tripping global rate-limit circuit breaker for ${GLOBAL_RATE_LIMIT_BACKOFF_MS / 1000}s`);
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
