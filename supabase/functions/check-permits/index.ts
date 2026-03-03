import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECGOV_HEADERS = {
  "User-Agent": "WildAtlas/1.0 (permit-availability-checker)",
  Accept: "application/json",
};

/**
 * Standard permits endpoint: /api/permits/{id}/availability/month
 * Used by Half Dome and similar lottery/daily permits.
 */
async function checkStandardPermit(
  recgovId: string
): Promise<{ available: boolean; availableDates: string[] }> {
  const availableDates: string[] = [];
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const startDate = monthStart.toISOString().split("T")[0] + "T00:00:00.000Z";
    const url = `https://www.recreation.gov/api/permits/${recgovId}/availability/month?start_date=${startDate}`;
    console.log(`Polling (standard): ${url}`);

    try {
      const res = await fetch(url, { headers: RECGOV_HEADERS });
      if (!res.ok) {
        console.error(`Recreation.gov returned ${res.status} for standard permit ${recgovId}`);
        await res.text(); // consume body
        continue;
      }
      const data = await res.json();
      const availability = data?.payload?.availability;
      if (!availability) continue;

      for (const divisionId of Object.keys(availability)) {
        const division = availability[divisionId];
        const dates = division?.date_availability || division;
        if (typeof dates !== "object" || dates === null) continue;
        for (const [dateStr, info] of Object.entries(dates)) {
          const slot = info as { remaining: number };
          if (new Date(dateStr) <= now) continue;
          if (slot.remaining > 0) availableDates.push(dateStr);
        }
      }
    } catch (err) {
      console.error(`Error fetching standard permit ${recgovId}:`, err);
    }
  }

  return { available: availableDates.length > 0, availableDates: availableDates.slice(0, 10) };
}

/**
 * Inyo-style permits endpoint: /api/permitinyo/{id}/availability
 * Used by Yosemite Wilderness, Inyo NF, and similar trailhead-quota permits.
 */
async function checkInyoPermit(
  recgovId: string
): Promise<{ available: boolean; availableDates: string[] }> {
  const availableDates: string[] = [];
  const now = new Date();
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  for (const monthStart of months) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
    const url = `https://www.recreation.gov/api/permitinyo/${recgovId}/availability?start_date=${startDate}&end_date=${endDate}`;
    console.log(`Polling (permitinyo): ${url}`);

    try {
      const res = await fetch(url, { headers: RECGOV_HEADERS });
      if (!res.ok) {
        console.error(`Recreation.gov returned ${res.status} for inyo permit ${recgovId}`);
        await res.text();
        continue;
      }
      const data = await res.json();
      const payload = data?.payload;
      if (!payload || typeof payload !== "object") continue;

      for (const [dateStr, trailheads] of Object.entries(payload)) {
        if (new Date(dateStr) <= now) continue;
        if (typeof trailheads !== "object" || trailheads === null) continue;
        for (const th of Object.values(trailheads as Record<string, any>)) {
          if (th?.remaining > 0) {
            availableDates.push(dateStr);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching inyo permit ${recgovId}:`, err);
    }
  }

  return { available: availableDates.length > 0, availableDates: availableDates.slice(0, 10) };
}

/**
 * Itinerary-style permits endpoint: /api/permititinerary/{id}/division/{divId}/availability/month
 * Used by Mount Rainier and other multi-division itinerary permits.
 * First fetches divisions from permitcontent, then checks each division.
 */
async function checkItineraryPermit(
  recgovId: string
): Promise<{ available: boolean; availableDates: string[] }> {
  const availableDates: string[] = [];
  const now = new Date();

  // Fetch divisions list
  let divisionIds: string[] = [];
  try {
    const contentUrl = `https://www.recreation.gov/api/permitcontent/${recgovId}`;
    console.log(`Fetching divisions: ${contentUrl}`);
    const contentRes = await fetch(contentUrl, { headers: RECGOV_HEADERS });
    if (!contentRes.ok) {
      console.error(`Failed to fetch permit content for ${recgovId}: ${contentRes.status}`);
      await contentRes.text();
      return { available: false, availableDates: [] };
    }
    const contentData = await contentRes.json();
    const payload = contentData?.payload;
    // divisions might be in payload.divisions or payload.permit_divisions
    const divisions = payload?.divisions || payload?.permit_divisions;
    if (divisions && typeof divisions === "object") {
      if (Array.isArray(divisions)) {
        divisionIds = divisions.map((d: any) => d.id || d.division_id).filter(Boolean);
      } else {
        // Could be an object keyed by division ID
        divisionIds = Object.keys(divisions);
      }
    }
    // Log payload keys for debugging
    console.log(`Permit content payload keys: ${payload ? Object.keys(payload).join(", ") : "null"}`);
    console.log(`Found ${divisionIds.length} divisions for permit ${recgovId}`);
  } catch (err) {
    console.error(`Error fetching divisions for ${recgovId}:`, err);
    return { available: false, availableDates: [] };
  }

  if (divisionIds.length === 0) {
    return { available: false, availableDates: [] };
  }

  // Check next 2 months, sample up to 10 divisions to avoid rate limits
  const sampled = divisionIds.slice(0, 10);
  const months = [
    { month: now.getMonth() + 1, year: now.getFullYear() },
    { month: now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2, year: now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear() },
  ];

  for (const div of sampled) {
    for (const { month, year } of months) {
      const url = `https://www.recreation.gov/api/permititinerary/${recgovId}/division/${div}/availability/month?month=${month}&year=${year}`;
      try {
        const res = await fetch(url, { headers: RECGOV_HEADERS });
        if (!res.ok) {
          await res.text();
          continue;
        }
        const data = await res.json();
        const quotaMaps = data?.payload?.quota_type_maps;
        if (!quotaMaps) continue;

        const memberDaily = quotaMaps.QuotaUsageByMemberDaily || {};
        const constantDaily = quotaMaps.ConstantQuotaUsageDaily || {};

        for (const [dateStr, info] of Object.entries(memberDaily) as [string, any][]) {
          if (new Date(dateStr) <= now) continue;
          const constantInfo = constantDaily[dateStr] as any;
          if (!constantInfo || constantInfo.remaining <= 0) continue;
          if (info.remaining > 0 && !info.show_walkup && !info.is_hidden) {
            availableDates.push(dateStr);
          }
        }
      } catch (err) {
        console.error(`Error checking itinerary div ${div}:`, err);
      }
    }

    // Early exit if we already found availability
    if (availableDates.length > 0) break;
  }

  // Deduplicate dates
  const unique = [...new Set(availableDates)];
  return { available: unique.length > 0, availableDates: unique.slice(0, 10) };
}

async function checkPermitAvailability(
  recgovId: string,
  apiType: string
): Promise<{ available: boolean; availableDates: string[] }> {
  if (apiType === "permitinyo") {
    return checkInyoPermit(recgovId);
  }
  if (apiType === "permititinerary") {
    return checkItineraryPermit(recgovId);
  }
  return checkStandardPermit(recgovId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    // Load permits registry including api_type
    const { data: permitRegistry } = await supabase
      .from("park_permits")
      .select("name, park_id, recgov_permit_id, api_type")
      .eq("is_active", true);

    const permitLookup = new Map<string, { recgovId: string; apiType: string }>();
    for (const p of permitRegistry ?? []) {
      if (p.recgov_permit_id) {
        permitLookup.set(`${p.park_id}:${p.name}`, {
          recgovId: p.recgov_permit_id,
          apiType: p.api_type || "standard",
        });
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
      const permit = permitLookup.get(key);
      if (!permit) {
        console.warn(`No recgov_permit_id for: ${key}`);
        for (const w of groupWatches) {
          results.push({ watchId: w.id, permitName: w.permit_name, parkId: w.park_id, found: false, error: "No Recreation.gov ID configured" });
        }
        continue;
      }

      const { available, availableDates } = await checkPermitAvailability(permit.recgovId, permit.apiType);

      // Log to public recent_finds for social proof (once per permit, not per user)
      if (available) {
        const [findParkId, findPermitName] = key.split(":");
        await supabase.from("recent_finds").insert({
          park_id: findParkId,
          permit_name: findPermitName,
          available_dates: availableDates ?? [],
        });
      }

      for (const watch of groupWatches) {
        if (available) {
          foundCount++;
          await supabase
            .from("active_watches")
            .update({ status: "found", is_active: false })
            .eq("id", watch.id);
          console.log(`✅ Permit FOUND for user ${watch.user_id}: ${watch.permit_name} (${watch.park_id})`);

          // Look up user profile for notification routing
          if (watch.notify_sms) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("phone_number, is_pro")
              .eq("user_id", watch.user_id)
              .maybeSingle();

            const isPro = profile?.is_pro ?? false;

            if (isPro && profile?.phone_number) {
              // Pro users: SMS
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
                console.log(`📱 SMS sent to Pro user ${watch.user_id}:`, smsResult);
              } catch (smsErr) {
                console.error(`SMS send failed for ${watch.user_id}:`, smsErr);
              }
            } else {
              console.log(`User ${watch.user_id} is free tier or no phone — skipping SMS`);
            }
          }

          // All users with active watches: send email alert (free-tier fallback)
          try {
            // Get user email from auth
            const { data: authData } = await supabase.auth.admin.getUserById(watch.user_id);
            const userEmail = authData?.user?.email;
            if (userEmail) {
              const emailUrl = `${supabaseUrl}/functions/v1/send-permit-email`;
              const emailRes = await fetch(emailUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  to: userEmail,
                  permitName: watch.permit_name,
                  parkName: watch.park_id,
                  availableDates,
                }),
              });
              const emailResult = await emailRes.json();
              console.log(`📧 Email sent to ${watch.user_id}:`, emailResult);
            }
          } catch (emailErr) {
            console.error(`Email send failed for ${watch.user_id}:`, emailErr);
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
