import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Recent notifications (last 48h, max 50)
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from("notification_log")
      .select("id, watch_id, channel, status, error_message, permit_name, park_id, retry_count, max_retries, next_retry_at, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50);

    // Summary counts
    const all = recent ?? [];
    const sent = all.filter((n: any) => n.status === "sent").length;
    const failed = all.filter((n: any) => n.status === "failed").length;
    const pendingRetry = all.filter((n: any) => n.status === "failed" && n.retry_count < n.max_retries && n.next_retry_at).length;
    const exhausted = all.filter((n: any) => n.status === "failed" && n.retry_count >= n.max_retries).length;

    return new Response(JSON.stringify({
      summary: { total: all.length, sent, failed, pending_retry: pendingRetry, exhausted },
      recent: all,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
