import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Simulated permit checker.
 * In production this would scrape/poll Recreation.gov APIs.
 * For now it randomly "finds" a permit ~10% of the time per active watch.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active watches
    const { data: watches, error: fetchError } = await supabase
      .from("active_watches")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!watches || watches.length === 0) {
      return new Response(JSON.stringify({ checked: 0, found: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let foundCount = 0;

    for (const watch of watches) {
      // Simulate a 10% chance of finding a permit opening
      const found = Math.random() < 0.1;

      if (found) {
        foundCount++;
        // Mark as found
        await supabase
          .from("active_watches")
          .update({ status: "found", is_active: false })
          .eq("id", watch.id);

        console.log(`Permit found for user ${watch.user_id}: ${watch.permit_name}`);
      }
    }

    return new Response(
      JSON.stringify({ checked: watches.length, found: foundCount }),
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
