import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  recgovPermitId: string
): Promise<{ available: boolean; availableDates: string[] }> {
  const availableDates: string[] = [];
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const startDate = monthStart.toISOString().split("T")[0] + "T00:00:00.000Z";
    const url = `${RECGOV_BASE}/${recgovPermitId}/availability/month?start_date=${startDate}`;
    console.log(`Polling Recreation.gov: ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "WildAtlas/1.0 (permit-availability-checker)",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        console.error(`Recreation.gov returned ${res.status} for permit ${recgovPermitId}`);
        continue;
      }
      const data = await res.json();
      const availability = data?.payload?.availability;
      if (!availability) continue;

      for (const divisionId of Object.keys(availability)) {
        const dates = availability[divisionId];
        if (typeof dates !== "object" || dates === null) continue;
        for (const [dateStr, info] of Object.entries(dates)) {
          const slot = info as AvailabilityDate;
          if (new Date(dateStr) <= now) continue;
          if (slot.remaining > 0) availableDates.push(dateStr);
        }
      }
    } catch (err) {
      console.error(`Error fetching permit ${recgovPermitId}:`, err);
    }
  }

  return { available: availableDates.length > 0, availableDates: availableDates.slice(0, 10) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active watches with their park context
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

    // Load the permits registry from DB (maps permit_name + park_id → recgov_permit_id)
    const { data: permitRegistry } = await supabase
      .from("park_permits")
      .select("name, park_id, recgov_permit_id")
      .eq("is_active", true);

    const permitLookup = new Map<string, string>();
    for (const p of permitRegistry ?? []) {
      if (p.recgov_permit_id) {
        permitLookup.set(`${p.park_id}:${p.name}`, p.recgov_permit_id);
      }
    }

    let foundCount = 0;
    const results: Array<{
      watchId: string;
      permitName: string;
      parkId: string;
      found: boolean;
      availableDates?: string[];
      error?: string;
    }> = [];

    // Group watches by park_id + permit_name to deduplicate API calls
    const groups: Record<string, typeof watches> = {};
    for (const w of watches) {
      const key = `${w.park_id}:${w.permit_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    }

    for (const [key, groupWatches] of Object.entries(groups)) {
      const recgovId = permitLookup.get(key);
      if (!recgovId) {
        console.warn(`No recgov_permit_id for: ${key}`);
        for (const w of groupWatches) {
          results.push({ watchId: w.id, permitName: w.permit_name, parkId: w.park_id, found: false, error: "No Recreation.gov ID configured" });
        }
        continue;
      }

      const { available, availableDates } = await checkPermitAvailability(recgovId);

      for (const watch of groupWatches) {
        if (available) {
          foundCount++;
          await supabase
            .from("active_watches")
            .update({ status: "found", is_active: false })
            .eq("id", watch.id);
          console.log(`✅ Permit FOUND for user ${watch.user_id}: ${watch.permit_name} (${watch.park_id})`);

          // Send SMS if user opted in
          if (watch.notify_sms) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("phone_number")
              .eq("user_id", watch.user_id)
              .maybeSingle();

            if (profile?.phone_number) {
              try {
                const smsUrl = `${supabaseUrl}/functions/v1/send-sms`;
                const smsRes = await fetch(smsUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({
                    to: profile.phone_number,
                    permitName: watch.permit_name,
                    parkName: watch.park_id,
                    availableDates,
                  }),
                });
                const smsResult = await smsRes.json();
                console.log(`📱 SMS result for ${watch.user_id}:`, smsResult);
              } catch (smsErr) {
                console.error(`SMS send failed for ${watch.user_id}:`, smsErr);
              }
            } else {
              console.warn(`User ${watch.user_id} has SMS on but no phone number`);
            }
          }
        }
        results.push({
          watchId: watch.id,
          permitName: watch.permit_name,
          parkId: watch.park_id,
          found: available,
          availableDates: available ? availableDates : undefined,
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: watches.length, found: foundCount, results, polledAt: new Date().toISOString() }),
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
