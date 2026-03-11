import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const GLOBAL_RATE_LIMIT_KEY = "__global_rate_limit__";
const GLOBAL_RATE_LIMIT_BACKOFF_MS = 600_000; // 10 minutes
const MAX_CONCURRENT_WORKERS = 5;

// ─── Scheduling intervals (ms) ──────────────────────────────────────────────
const PRIORITY_INTERVALS: Record<string, { label: string; ms: number }> = {
  high:   { label: "high (2 min)",  ms: 2 * 60_000 },
  medium: { label: "medium (5 min)", ms: 5 * 60_000 },
  low:    { label: "low (10 min)",  ms: 10 * 60_000 },
};

// Boost: if availability was found recently, scan faster
const RECENT_FIND_BOOST_MS = 60_000; // 1 minute interval
const RECENT_FIND_WINDOW_MS = 30 * 60_000; // "recently" = last 30 min

// Slow-down: if no recent activity, scan slower
const INACTIVE_SLOWDOWN_MS = 15 * 60_000; // 15 min interval
const INACTIVE_THRESHOLD_MS = 24 * 3600_000; // no check in 24h = inactive

/**
 * Compute the next_check_at interval for a scan target based on:
 * 1. scan_priority field (0 = low, 1 = medium, 2+ = high)
 * 2. If availability was found recently → boost to 1 min
 * 3. If target hasn't been checked in 24h → slow to 15 min
 */
function computeNextInterval(
  scanPriority: number,
  lastCheckedAt: string | null,
  recentFindAt: string | null,
  now: Date
): { intervalMs: number; reason: string } {
  // 1. Check for recent find boost
  if (recentFindAt) {
    const findAge = now.getTime() - new Date(recentFindAt).getTime();
    if (findAge < RECENT_FIND_WINDOW_MS) {
      return { intervalMs: RECENT_FIND_BOOST_MS, reason: "recent find boost (1 min)" };
    }
  }

  // 2. Check for inactivity slow-down
  if (lastCheckedAt) {
    const checkAge = now.getTime() - new Date(lastCheckedAt).getTime();
    if (checkAge > INACTIVE_THRESHOLD_MS) {
      return { intervalMs: INACTIVE_SLOWDOWN_MS, reason: "inactive slowdown (15 min)" };
    }
  }

  // 3. Priority-based interval
  if (scanPriority >= 2) return { intervalMs: PRIORITY_INTERVALS.high.ms, reason: PRIORITY_INTERVALS.high.label };
  if (scanPriority === 1) return { intervalMs: PRIORITY_INTERVALS.medium.ms, reason: PRIORITY_INTERVALS.medium.label };
  return { intervalMs: PRIORITY_INTERVALS.low.ms, reason: PRIORITY_INTERVALS.low.label };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured — rejecting request");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== cronSecret && token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // 1. Load only DUE scan_targets (status=active AND next_check_at <= now)
    const now = new Date();
    const PAGE_SIZE = 500;
    const scanTargets: any[] = [];
    let page = 0;
    while (true) {
      const { data: batch, error: fetchError } = await supabase
        .from("scan_targets")
        .select("*")
        .eq("status", "active")
        .lte("next_check_at", now.toISOString())
        .order("scan_priority", { ascending: false })
        .order("next_check_at", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (fetchError) throw fetchError;
      if (!batch || batch.length === 0) break;
      scanTargets.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    if (scanTargets.length === 0) {
      return new Response(JSON.stringify({ checked: 0, dispatched: 0, message: "No scan targets due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`📋 ${scanTargets.length} scan targets due for checking`);
    const prioBreakdown = scanTargets.reduce((acc: Record<string, number>, st: any) => {
      const p = st.scan_priority ?? 0;
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Priority breakdown: ${prioBreakdown[2] ?? 0} Pro (priority 2, 2 min), ${prioBreakdown[1] ?? 0} free (priority 1, 5 min), ${prioBreakdown[0] ?? 0} low (priority 0, 10 min)`);

    // 2. Load subscribed user_watchers for due targets
    const scanTargetIds = scanTargets.map((st: any) => st.id);
    const allWatchers: any[] = [];
    for (let i = 0; i < scanTargetIds.length; i += PAGE_SIZE) {
      const idBatch = scanTargetIds.slice(i, i + PAGE_SIZE);
      const { data: watchers } = await supabase
        .from("user_watchers")
        .select("*")
        .in("scan_target_id", idBatch)
        .eq("is_active", true);
      if (watchers) allWatchers.push(...watchers);
    }

    const watchersByTarget = new Map<string, any[]>();
    for (const w of allWatchers) {
      const list = watchersByTarget.get(w.scan_target_id) || [];
      list.push(w);
      watchersByTarget.set(w.scan_target_id, list);
    }

    // 3. Load permit registry for recgov IDs
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

    // 4. Load recent finds for boost detection (last 30 min)
    const recentFindCutoff = new Date(now.getTime() - RECENT_FIND_WINDOW_MS).toISOString();
    const { data: recentFinds } = await supabase
      .from("recent_finds")
      .select("park_id, permit_name, found_at")
      .gte("found_at", recentFindCutoff);

    const recentFindLookup = new Map<string, string>();
    for (const f of recentFinds ?? []) {
      const key = `${f.park_id}:${f.permit_name}`;
      const existing = recentFindLookup.get(key);
      if (!existing || f.found_at > existing) {
        recentFindLookup.set(key, f.found_at);
      }
    }

    // 5. Build worker payloads
    const workerPayloads: Array<{
      scanTargetId: string;
      permitKey: string;
      recgovId: string;
      apiType: string;
      parkName: string;
      watchers: any[];
      scanPriority: number;
      lastCheckedAt: string | null;
      recentFindAt: string | null;
    }> = [];

    const orphanedTargets: Array<{
      scanTargetId: string;
      permitKey: string;
    }> = [];

    for (const st of scanTargets) {
      const key = `${st.park_id}:${st.permit_type}`;
      const permit = permitLookup.get(key);
      if (!permit) {
        console.warn(`No recgov_permit_id for: ${key} — skipping`);
        continue;
      }
      const watchers = watchersByTarget.get(st.id) || [];
      if (watchers.length === 0) {
        orphanedTargets.push({
          scanTargetId: st.id,
          permitKey: key,
        });
        continue;
      }

      workerPayloads.push({
        scanTargetId: st.id,
        permitKey: key,
        recgovId: permit.recgovId,
        apiType: permit.apiType,
        parkName: parkNameLookup.get(st.park_id) ?? st.park_id,
        watchers,
        scanPriority: st.scan_priority ?? 0,
        lastCheckedAt: st.last_checked_at,
        recentFindAt: recentFindLookup.get(key) ?? null,
      });
    }

    console.log(`🚀 Dispatching ${workerPayloads.length} permit workers (max ${MAX_CONCURRENT_WORKERS} concurrent); rescheduling ${orphanedTargets.length} orphaned targets`);

    // 6. Fan out to check-single-permit workers
    const workerUrl = `${supabaseUrl}/functions/v1/check-single-permit`;
    const workerResults: Array<{ permitKey: string; result?: any; error?: string }> = [];

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
          if (settled.value.result?.rateLimited) {
            console.log(`🛑 Global rate limit detected — stopping further dispatches`);
            i = workerPayloads.length;
            break;
          }
        } else {
          workerResults.push({ permitKey: "unknown", error: String(settled.reason) });
        }
      }
    }

    // 7. Update next_check_at per-target using priority-based scheduling
    const schedulingLog: Array<{ target: string; interval: string; reason: string }> = [];

    for (const payload of workerPayloads) {
      const { intervalMs, reason } = computeNextInterval(
        payload.scanPriority,
        now.toISOString(), // just checked
        payload.recentFindAt,
        now
      );

      const nextCheckAt = new Date(now.getTime() + intervalMs).toISOString();

      await supabase
        .from("scan_targets")
        .update({
          last_checked_at: now.toISOString(),
          next_check_at: nextCheckAt,
        })
        .eq("id", payload.scanTargetId);

      schedulingLog.push({
        target: payload.permitKey,
        interval: `${intervalMs / 1000}s`,
        reason,
      });
    }

    // Orphaned targets (0 active watchers) are not dispatched; still advance schedule to prevent queue clogging
    for (const orphaned of orphanedTargets) {
      const nextCheckAt = new Date(now.getTime() + INACTIVE_SLOWDOWN_MS).toISOString();

      // Get current orphaned_at to determine if we should set it
      const { data: currentTarget } = await supabase
        .from("scan_targets")
        .select("orphaned_at")
        .eq("id", orphaned.scanTargetId)
        .single();

      await supabase
        .from("scan_targets")
        .update({
          last_checked_at: now.toISOString(),
          next_check_at: nextCheckAt,
          // Set orphaned_at timestamp if not already set
          orphaned_at: currentTarget?.orphaned_at || now.toISOString(),
        })
        .eq("id", orphaned.scanTargetId);

      schedulingLog.push({
        target: orphaned.permitKey,
        interval: `${INACTIVE_SLOWDOWN_MS / 1000}s`,
        reason: "orphaned target (no active watchers)",
      });
    }

    console.log(`📅 Scheduling log:\n${schedulingLog.map(s => `  ${s.target}: next in ${s.interval} (${s.reason})`).join("\n")}`);

    const totalFound = workerResults.reduce((sum, r) => sum + (r.result?.found || 0), 0);
    const totalEnqueued = workerResults.reduce((sum, r) => sum + (r.result?.enqueued || 0), 0);
    const errors = workerResults.filter((r) => r.error);

    // Write scanner heartbeat
    const allWorkersFailed = workerResults.length > 0 && errors.length === workerResults.length;
    const heartbeatPayload = {
      cache_key: "__scanner_heartbeat__",
      recgov_id: "heartbeat",
      api_type: "heartbeat",
      available: !allWorkersFailed,
      available_dates: [],
      fetched_at: now.toISOString(),
      stale_at: new Date(now.getTime() + 15 * 60_000).toISOString(),
      expires_at: new Date(now.getTime() + 24 * 3600_000).toISOString(),
      error_count: errors.length,
      last_error: errors.length > 0 ? `${errors.length}/${workerResults.length} workers failed` : null,
      last_status_code: allWorkersFailed ? 500 : (errors.length > 0 ? 207 : 200),
    };
    await supabase.from("permit_cache").upsert(heartbeatPayload, { onConflict: "cache_key" });

    console.log(`✅ Orchestrator complete: ${workerResults.length} targets processed, ${totalFound} found, ${totalEnqueued} enqueued, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        checked: scanTargets.length,
        dispatched: workerPayloads.length,
        completed: workerResults.length,
        found: totalFound,
        enqueued: totalEnqueued,
        errors: errors.length,
        scheduling: schedulingLog,
        workerResults,
        polledAt: now.toISOString(),
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
