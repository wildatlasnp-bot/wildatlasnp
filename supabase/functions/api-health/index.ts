import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recent API health logs (last 24h)
    const { data: healthLogs } = await supabase
      .from("api_health_log")
      .select("*")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    // Cache entries
    const { data: cacheEntries } = await supabase
      .from("permit_cache")
      .select("*")
      .order("fetched_at", { ascending: false });

    const now = new Date();
    const logs = healthLogs ?? [];
    const cache = cacheEntries ?? [];

    // Compute stats
    const totalRequests = logs.length;
    const successCount = logs.filter((l) => l.status_code && l.status_code >= 200 && l.status_code < 300).length;
    const rateLimitCount = logs.filter((l) => l.status_code === 429).length;
    const errorCount = logs.filter((l) => l.status_code && l.status_code >= 400).length;
    const avgResponseTime = totalRequests > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.response_time_ms ?? 0), 0) / totalRequests)
      : 0;

    // Cache stats
    const hotEntries = cache.filter((c) => new Date(c.stale_at) > now).length;
    const staleEntries = cache.filter((c) => new Date(c.stale_at) <= now && new Date(c.expires_at) > now).length;
    const expiredEntries = cache.filter((c) => new Date(c.expires_at) <= now).length;

    // Circuit breaker: permits with 3+ consecutive errors
    const circuitBroken = cache.filter((c) => c.error_count >= 3).map((c) => ({
      cache_key: c.cache_key,
      recgov_id: c.recgov_id,
      error_count: c.error_count,
      last_error: c.last_error,
      last_status_code: c.last_status_code,
      fetched_at: c.fetched_at,
    }));

    // Recent errors
    const recentErrors = logs
      .filter((l) => l.status_code && l.status_code >= 400)
      .slice(0, 10)
      .map((l) => ({
        endpoint: l.endpoint,
        status_code: l.status_code,
        error_message: l.error_message,
        response_time_ms: l.response_time_ms,
        created_at: l.created_at,
      }));

    return new Response(
      JSON.stringify({
        generated_at: now.toISOString(),
        api_health: {
          total_requests_24h: totalRequests,
          success_count: successCount,
          error_count: errorCount,
          rate_limit_count: rateLimitCount,
          success_rate: totalRequests > 0 ? `${((successCount / totalRequests) * 100).toFixed(1)}%` : "N/A",
          avg_response_time_ms: avgResponseTime,
        },
        cache_status: {
          total_entries: cache.length,
          hot: hotEntries,
          stale: staleEntries,
          expired: expiredEntries,
        },
        circuit_breaker: {
          tripped_count: circuitBroken.length,
          tripped_permits: circuitBroken,
        },
        recent_errors: recentErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
