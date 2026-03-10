import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the internal NPS park JSON date format to "YYYY-MM-DD".
 *
 * NPS internal JSON uses: "January, 05 2026 00:00:00"
 * (note the comma after the month name, no timezone specifier).
 * We strip the comma and let V8 parse it, then extract the date component.
 * Midnight times are safe — no cross-date timezone shifts at 00:00 local.
 */
function parseNpsDate(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  try {
    const cleaned = dateStr.replace(",", "").trim();
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;
    // Return UTC date component; local midnight avoids off-by-one in any TZ
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Fetch the NPS website's internal park-alerts JSON and build a map of
 * alertId → ISO date string ("YYYY-MM-DD").
 *
 * The NPS website (nps.gov) renders "Date Posted:" using `start_date` from
 * this file, which is what users compare against our display. The developer
 * API only provides `lastIndexedDate` (re-index timestamp), which diverges.
 *
 * Fields checked in priority order:
 *   1. start_date          — general alert post date
 *   2. road_closure_start_date — for road closure alerts
 *
 * Returns an empty map on any fetch or parse failure (non-fatal).
 */
async function fetchParkStartDates(npsCode: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const url = `https://www.nps.gov/${npsCode}/park-alerts-${npsCode}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "WildAtlas/1.0 (permit-availability-checker)" },
    });
    if (!res.ok) {
      console.warn(`Internal park JSON ${npsCode}: HTTP ${res.status}`);
      return map;
    }
    const alerts = await res.json();
    if (!Array.isArray(alerts)) return map;

    for (const alert of alerts) {
      if (!alert.id) continue;
      const rawDate = alert.start_date || alert.road_closure_start_date;
      const parsed = parseNpsDate(rawDate);
      if (parsed) map.set(alert.id, parsed);
    }
  } catch (err) {
    console.warn(`Could not fetch internal park JSON for ${npsCode}:`, err);
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
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
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const NPS_API_KEY = Deno.env.get("NPS_API_KEY");
  if (!NPS_API_KEY) {
    return new Response(JSON.stringify({ error: "NPS_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Build parkCode CSV for a single developer API call
    const npsCodeToId: Record<string, string> = {};
    for (const p of parks) {
      npsCodeToId[p.nps_code!.toLowerCase()] = p.id;
    }
    const parkCodes = Object.keys(npsCodeToId).join(",");

    // Fetch developer API alerts + internal park JSONs in parallel.
    // The internal JSONs provide start_date, which is what the NPS website
    // shows as "Date Posted:" — the authoritative user-visible date.
    const [apiRes, ...startDateResults] = await Promise.allSettled([
      fetch(`https://developer.nps.gov/api/v1/alerts?parkCode=${parkCodes}&limit=50&api_key=${NPS_API_KEY}`),
      ...parks.map((p) => fetchParkStartDates(p.nps_code!.toLowerCase())),
    ]);

    if (apiRes.status === "rejected" || (apiRes.status === "fulfilled" && !apiRes.value.ok)) {
      const body = apiRes.status === "fulfilled" ? await apiRes.value.text() : String(apiRes.reason);
      console.error(`NPS API error: ${body}`);
      return new Response(
        JSON.stringify({ error: "NPS API request failed" }),
        { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Merge all per-park start_date maps into one alertId → date map
    const alertStartDates = new Map<string, string>();
    for (const result of startDateResults) {
      if (result.status === "fulfilled") {
        for (const [id, date] of result.value) {
          alertStartDates.set(id, date);
        }
      }
    }

    const json = await (apiRes as PromiseFulfilledResult<Response>).value.json();
    const alerts: NPSAlert[] = json.data ?? [];

    // Upsert alerts into park_alerts
    let upserted = 0;
    for (const alert of alerts) {
      const parkCode = alert.parkCode?.toLowerCase();
      const parkId = npsCodeToId[parkCode];
      if (!parkId) continue; // alert for a park we don't track

      // Use start_date from the NPS website's internal JSON when available —
      // this matches what nps.gov shows as "Date Posted:".
      // Fall back to lastIndexedDate (API re-index timestamp) as a last resort.
      const startDate = alertStartDates.get(alert.id);
      const lastUpdated = startDate
        ?? (alert.lastIndexedDate ? alert.lastIndexedDate.slice(0, 10) : null)
        ?? new Date().toISOString().slice(0, 10);

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
            last_updated: lastUpdated,
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
        start_dates_found: alertStartDates.size,
      }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NPS alerts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
