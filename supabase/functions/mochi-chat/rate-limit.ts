/**
 * DB-backed rate limiting for the mochi-chat edge function.
 *
 * Two layers, both checked against the `mochi_rate_limits` table:
 *   1. Per-minute cap — 10 requests in the last 60s for ALL users
 *   2. Daily cap      — FREE_DAILY_CAP requests since UTC midnight (free users only)
 *
 * Behavior on DB failure:
 *   - Transient errors (timeout, AbortError) → fail OPEN (allow the request).
 *     This prevents a brief Postgres hiccup from locking everyone out.
 *   - Hard errors (PostgREST returns rows but with an error) → fail CLOSED.
 *     A persistently broken table is more dangerous than blocking traffic.
 *
 * Returns either `null` (allowed) or a Response that the caller should
 * return immediately. Insertion of the request marker is fire-and-forget
 * after the checks pass.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const FREE_DAILY_CAP = 20;

const MINUTE_CAP = 10;

type CorsHeaders = Record<string, string>;

interface RateLimitDeps {
  adminClient: SupabaseClient;
  userId: string;
  isPro: boolean;
  corsHeaders: CorsHeaders;
}

function isTransientError(err: { name?: string; message?: string }): boolean {
  return (
    err.name === "AbortError" ||
    !!err.message?.toLowerCase().includes("timeout")
  );
}

function rateLimitResponse(corsHeaders: CorsHeaders, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function enforceRateLimit({
  adminClient,
  userId,
  isPro,
  corsHeaders,
}: RateLimitDeps): Promise<Response | null> {
  // ── Per-minute cap (all users) ──
  try {
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: countErr } = await adminClient
      .from("mochi_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", windowStart);
    if (countErr) {
      if (!isTransientError(countErr)) {
        console.error("[RATE LIMIT] DB error — failing closed:", (countErr as any).code, countErr.message);
        return rateLimitResponse(corsHeaders, { error: "rate_limit" });
      }
      console.warn("[RATE LIMIT] Transient DB error — allowing request through:", countErr.message);
    } else if ((recentCount ?? 0) >= MINUTE_CAP) {
      return rateLimitResponse(corsHeaders, { error: "Rate limit exceeded. Try again in a minute." });
    }
  } catch (err: any) {
    if (!isTransientError(err)) {
      console.error("[RATE LIMIT] DB error — failing closed:", err.code, err.message);
      return rateLimitResponse(corsHeaders, { error: "rate_limit" });
    }
    console.warn("[RATE LIMIT] Transient DB error — allowing request through:", err.message);
  }

  // ── Daily cap (free users only) ──
  if (!isPro) {
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count: dailyCount, error: dailyErr } = await adminClient
        .from("mochi_rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString());
      if (dailyErr) {
        if (!isTransientError(dailyErr)) {
          console.error("[RATE LIMIT] DB error — failing closed:", (dailyErr as any).code, dailyErr.message);
          return rateLimitResponse(corsHeaders, { error: "rate_limit" });
        }
        console.warn("[RATE LIMIT] Transient DB error — allowing request through:", dailyErr.message);
      } else if ((dailyCount ?? 0) >= FREE_DAILY_CAP) {
        return rateLimitResponse(corsHeaders, {
          error: `You've reached your daily limit of ${FREE_DAILY_CAP} messages. Upgrade to Pro for unlimited Poko access.`,
        });
      }
    } catch (err: any) {
      if (!isTransientError(err)) {
        console.error("[RATE LIMIT] DB error — failing closed:", err.code, err.message);
        return rateLimitResponse(corsHeaders, { error: "rate_limit" });
      }
      console.warn("[RATE LIMIT] Transient DB error — allowing request through:", err.message);
    }
  }

  return null;
}

/** Fire-and-forget: record the request after enforceRateLimit has allowed it. */
export async function recordRateLimitHit(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    await adminClient.from("mochi_rate_limits").insert({ user_id: userId });
  } catch (err) {
    console.error("[rate-limit] Insert failed (failing open):", err);
  }
}
