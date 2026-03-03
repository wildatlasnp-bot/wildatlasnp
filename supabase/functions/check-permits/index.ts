import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Permit name → Recreation.gov permit configuration.
 * The availability endpoint is:
 *   https://www.recreation.gov/api/permits/{permitId}/availability/month?start_date=YYYY-MM-01T00:00:00.000Z
 *
 * No API key is required for the public availability endpoint.
 */
const PERMIT_CONFIGS: Record<string, { permitId: string; type: "permit_availability" }> = {
  "Half Dome": {
    permitId: "234652",
    type: "permit_availability",
  },
  "Yosemite Wilderness": {
    permitId: "233262",
    type: "permit_availability",
  },
};

const RECGOV_BASE = "https://www.recreation.gov/api/permits";

interface AvailabilityDate {
  remaining: number;
  total: number;
  is_walkup: boolean;
  date_availability_description: string;
}

/**
 * Check Recreation.gov permit availability for the current and next month.
 * Returns true if ANY date in the response has remaining > 0.
 */
async function checkPermitAvailability(
  permitId: string
): Promise<{ available: boolean; availableDates: string[] }> {
  const availableDates: string[] = [];

  // Check current month and next month
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const startDate = monthStart.toISOString().split("T")[0] + "T00:00:00.000Z";
    const url = `${RECGOV_BASE}/${permitId}/availability/month?start_date=${startDate}`;

    console.log(`Polling Recreation.gov: ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "WildAtlas/1.0 (permit-availability-checker)",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error(`Recreation.gov returned ${res.status} for permit ${permitId}`);
        continue;
      }

      const data = await res.json();

      // The response structure contains availability keyed by date or by division.
      // Structure: { "payload": { "availability": { "<division_id>": { "<date>": { remaining, total, ... } } } } }
      const availability = data?.payload?.availability;
      if (!availability) {
        console.log(`No availability payload for permit ${permitId}`);
        continue;
      }

      // Iterate through all divisions
      for (const divisionId of Object.keys(availability)) {
        const dates = availability[divisionId];
        if (typeof dates !== "object" || dates === null) continue;

        for (const [dateStr, info] of Object.entries(dates)) {
          const slot = info as AvailabilityDate;
          // Only consider future dates
          const slotDate = new Date(dateStr);
          if (slotDate <= now) continue;

          if (slot.remaining > 0) {
            availableDates.push(dateStr);
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching permit ${permitId}:`, err);
    }
  }

  return {
    available: availableDates.length > 0,
    availableDates: availableDates.slice(0, 10), // cap at 10 for brevity
  };
}

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
      return new Response(JSON.stringify({ checked: 0, found: 0, message: "No active watches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let foundCount = 0;
    const results: Array<{
      watchId: string;
      permitName: string;
      found: boolean;
      availableDates?: string[];
      error?: string;
    }> = [];

    // Deduplicate: group watches by permit name so we only poll each permit once
    const permitGroups: Record<string, typeof watches> = {};
    for (const watch of watches) {
      const name = watch.permit_name;
      if (!permitGroups[name]) permitGroups[name] = [];
      permitGroups[name].push(watch);
    }

    for (const [permitName, groupWatches] of Object.entries(permitGroups)) {
      const config = PERMIT_CONFIGS[permitName];
      if (!config) {
        console.warn(`No Recreation.gov config for permit: ${permitName}`);
        for (const w of groupWatches) {
          results.push({
            watchId: w.id,
            permitName,
            found: false,
            error: "Unsupported permit type",
          });
        }
        continue;
      }

      const { available, availableDates } = await checkPermitAvailability(config.permitId);

      for (const watch of groupWatches) {
        if (available) {
          foundCount++;
          // Mark as found
          await supabase
            .from("active_watches")
            .update({ status: "found", is_active: false })
            .eq("id", watch.id);

          console.log(
            `✅ Permit FOUND for user ${watch.user_id}: ${permitName} — ${availableDates.length} date(s) open`
          );
        }

        results.push({
          watchId: watch.id,
          permitName,
          found: available,
          availableDates: available ? availableDates : undefined,
        });
      }
    }

    return new Response(
      JSON.stringify({
        checked: watches.length,
        found: foundCount,
        results,
        polledAt: new Date().toISOString(),
      }),
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
