import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NPSAlert {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  lastIndexedDate: string;
  parkCode: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: CRON_SECRET, service role key, or authenticated user
  const cronSecret = Deno.env.get("CRON_SECRET");
  const svcRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  let authorized = false;
  if (token === cronSecret || token === svcRoleKey) {
    authorized = true;
  } else if (token && token !== anonKey) {
    // Verify it's a valid authenticated user JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const verifyClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await verifyClient.auth.getUser();
    if (user) authorized = true;
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const NPS_API_KEY = Deno.env.get("NPS_API_KEY");
  if (!NPS_API_KEY) {
    return new Response(JSON.stringify({ error: "NPS_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get active parks with nps_code
    const { data: parks, error: parksErr } = await supabase
      .from("parks")
      .select("id, nps_code")
      .eq("is_active", true)
      .not("nps_code", "is", null);

    if (parksErr) throw parksErr;
    if (!parks || parks.length === 0) {
      return new Response(JSON.stringify({ message: "No parks with NPS codes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build parkCode CSV for a single API call
    const npsCodeToId: Record<string, string> = {};
    for (const p of parks) {
      npsCodeToId[p.nps_code!.toLowerCase()] = p.id;
    }
    const parkCodes = Object.keys(npsCodeToId).join(",");

    // Fetch alerts from NPS API (max 50 per park should be plenty)
    const url = `https://developer.nps.gov/api/v1/alerts?parkCode=${parkCodes}&limit=50&api_key=${NPS_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      console.error(`NPS API error [${res.status}]: ${body}`);
      return new Response(
        JSON.stringify({ error: `NPS API returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await res.json();
    const alerts: NPSAlert[] = json.data ?? [];

    // Upsert alerts into park_alerts
    let upserted = 0;
    for (const alert of alerts) {
      const parkCode = alert.parkCode?.toLowerCase();
      const parkId = npsCodeToId[parkCode];
      if (!parkId) continue; // alert for a park we don't track

      const { error: upsertErr } = await supabase
        .from("park_alerts")
        .upsert(
          {
            nps_alert_id: alert.id,
            park_id: parkId,
            title: alert.title,
            description: alert.description?.slice(0, 2000) ?? null,
            category: alert.category || "Information",
            url: alert.url || null,
            last_updated: alert.lastIndexedDate || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "nps_alert_id" }
        );

      if (upsertErr) {
        console.error(`Upsert error for alert ${alert.id}:`, upsertErr);
      } else {
        upserted++;
      }
    }

    // Clean up alerts that are no longer in the NPS feed
    const currentIds = alerts
      .filter((a) => npsCodeToId[a.parkCode?.toLowerCase()])
      .map((a) => a.id);

    if (currentIds.length > 0) {
      const parkIds = Object.values(npsCodeToId);
      await supabase
        .from("park_alerts")
        .delete()
        .in("park_id", parkIds)
        .not("nps_alert_id", "in", `(${currentIds.map((id) => `"${id}"`).join(",")})`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_from_nps: alerts.length,
        upserted,
        parks_checked: parks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NPS alerts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
