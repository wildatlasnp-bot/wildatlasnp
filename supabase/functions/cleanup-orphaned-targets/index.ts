import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://wildatlasnp.lovable.app", "http://localhost:8080"];

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORPHANED_THRESHOLD_MS = 24 * 3600_000; // 24 hours

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (token !== cronSecret && token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const threshold = new Date(now.getTime() - ORPHANED_THRESHOLD_MS);

    console.log(`🧹 Scanning for orphaned targets older than ${threshold.toISOString()}`);

    // Find scan_targets that have been orphaned for > 24 hours
    const { data: orphanedTargets, error: fetchError } = await supabase
      .from("scan_targets")
      .select("id, park_id, permit_type, orphaned_at")
      .eq("status", "active")
      .not("orphaned_at", "is", null)
      .lte("orphaned_at", threshold.toISOString());

    if (fetchError) throw fetchError;

    if (!orphanedTargets || orphanedTargets.length === 0) {
      console.log("✅ No orphaned targets to clean up");
      return new Response(
        JSON.stringify({
          paused: 0,
          message: "No orphaned targets found older than 24 hours",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🚨 Found ${orphanedTargets.length} orphaned targets to pause`);

    // Pause these targets by setting status to 'paused'
    const targetIds = orphanedTargets.map((t) => t.id);
    const { error: updateError } = await supabase
      .from("scan_targets")
      .update({ status: "paused" })
      .in("id", targetIds);

    if (updateError) throw updateError;

    const pausedTargets = orphanedTargets.map((t) => ({
      id: t.id,
      permitKey: `${t.park_id}:${t.permit_type}`,
      orphanedAt: t.orphaned_at,
      orphanedDuration: `${Math.round(
        (now.getTime() - new Date(t.orphaned_at!).getTime()) / 3600_000
      )}h`,
    }));

    console.log(
      `✅ Paused ${pausedTargets.length} orphaned targets:\n${pausedTargets
        .map((t) => `  - ${t.permitKey} (orphaned ${t.orphanedDuration} ago)`)
        .join("\n")}`
    );

    return new Response(
      JSON.stringify({
        paused: pausedTargets.length,
        targets: pausedTargets,
        threshold: "24 hours",
        ranAt: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("cleanup-orphaned-targets error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
