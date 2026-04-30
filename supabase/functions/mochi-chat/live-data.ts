/**
 * Live data fetchers used to ground the system prompt in current,
 * authoritative information rather than model training memory.
 *
 *   fetchNPSAlerts        — recent park alerts from our cache table
 *   fetchWeather          — National Weather Service live observation + fallback
 *   fetchPermitStatus     — user's tracked permits (active watches)
 *   fetchScannerHeartbeat — last successful scan timestamp
 *
 * All fetchers fail soft — they return a plain-English "unavailable"
 * string rather than throwing, so a single upstream outage cannot
 * break the chat response.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PARK_META } from "./parks.ts";

const NWS_HEADERS = { "User-Agent": "WildAtlas/1.0", Accept: "application/geo+json" };

/** Lazy admin client — caller may share one across fetches. */
function adminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function fetchNPSAlerts(parkId: string, parkName: string): Promise<string> {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("park_alerts")
      .select("category, title, description")
      .eq("park_id", parkId)
      .order("last_updated", { ascending: false })
      .limit(5);
    if (error || !data || data.length === 0) return `No active NPS alerts for ${parkName}.`;
    return data
      .map((a: any) => `[${a.category}] ${a.title}: ${a.description?.slice(0, 200)}`)
      .join("\n");
  } catch (e) {
    console.error("NPS alerts fetch failed:", e);
    return "NPS alerts unavailable.";
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<string> {
  try {
    // Step 1: Get metadata including observation stations URL
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) },
    );
    if (!pointRes.ok) return "Weather data unavailable.";
    const pointData = await pointRes.json();
    const observationStationsUrl = pointData.properties?.observationStations;
    const forecastUrl = pointData.properties?.forecast;

    // Step 2: Try live observations first
    if (observationStationsUrl) {
      const stationsRes = await fetch(observationStationsUrl, {
        headers: NWS_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (stationsRes.ok) {
        const stationsData = await stationsRes.json();
        const firstStation = stationsData.features?.[0]?.properties?.stationIdentifier;
        if (firstStation) {
          const obsRes = await fetch(
            `https://api.weather.gov/stations/${firstStation}/observations/latest`,
            { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) },
          );
          if (obsRes.ok) {
            const obsData = await obsRes.json();
            const props = obsData.properties;
            const tempC = props?.temperature?.value;
            const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;
            console.log(`[fetchWeather] lat=${lat} lon=${lon} station=${firstStation} tempC=${tempC} tempF=${tempF}`);
            const description = props?.textDescription ?? "conditions unknown";
            const windSpeedMs = props?.windSpeed?.value;
            const windMph = windSpeedMs != null ? Math.round(windSpeedMs * 2.237) : null;
            const humidity = props?.relativeHumidity?.value != null
              ? Math.round(props.relativeHumidity.value)
              : null;

            if (tempF != null) {
              return [
                `Current conditions (live): ${tempF}°F, ${description}.`,
                windMph != null ? `Wind: ${windMph} mph.` : null,
                humidity != null ? `Humidity: ${humidity}%.` : null,
              ]
                .filter(Boolean)
                .join(" ");
            }
          }
        }
      }
    }

    // Step 3: Fall back to forecast periods if observations unavailable
    if (!forecastUrl) return "Weather data unavailable.";
    const forecastRes = await fetch(forecastUrl, {
      headers: NWS_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!forecastRes.ok) return "Weather forecast unavailable.";
    const forecastData = await forecastRes.json();
    const periods = forecastData.properties?.periods ?? [];
    const forecastLines = periods
      .slice(0, 4)
      .map(
        (p: any) =>
          `${p.name}: ${p.temperature}°${p.temperatureUnit}, ${p.shortForecast}. Wind ${p.windSpeed} ${p.windDirection}.`,
      )
      .join("\n");
    return `Forecast data (not current conditions):\n${forecastLines}`;
  } catch (e) {
    console.error("Weather fetch failed:", e);
    return "Weather data unavailable.";
  }
}

export interface PermitStatusResult {
  watches: string;
  allParksWatches: string[];
  trackedParkIds: string[];
}

export async function fetchPermitStatus(userId: string | null): Promise<PermitStatusResult> {
  if (!userId) return { watches: "User has no tracked permits.", allParksWatches: [], trackedParkIds: [] };
  try {
    const supabase = adminClient();
    const { data } = await supabase
      .from("user_watchers")
      .select("status, is_active, scan_targets(permit_type, park_id)")
      .eq("user_id", userId);
    if (!data || data.length === 0) return { watches: "User has no tracked permits.", allParksWatches: [], trackedParkIds: [] };
    const active = data.filter((w: any) => w.is_active);
    if (active.length === 0) return { watches: "User has no active permit watches.", allParksWatches: [], trackedParkIds: [] };
    const lines = active.map((w: any) => {
      const parkName = PARK_META[w.scan_targets?.park_id]?.name?.replace(" National Park", "") ?? w.scan_targets?.park_id;
      return `• ${w.scan_targets?.permit_type} (${parkName}): ACTIVELY MONITORING`;
    });
    return {
      watches: lines.join("\n"),
      allParksWatches: active.map((w: any) => w.scan_targets?.permit_type),
      trackedParkIds: active.map((w: any) => w.scan_targets?.park_id).filter(Boolean),
    };
  } catch (e) {
    console.error("Permit status fetch failed:", e);
    return { watches: "Permit status unavailable.", allParksWatches: [], trackedParkIds: [] };
  }
}

export async function fetchScannerHeartbeat(): Promise<string> {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("permit_cache")
      .select("fetched_at, available, error_count")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle();
    if (error || !data) return "Scanner heartbeat: no data yet (starting up).";
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    const ageMins = Math.floor(ageMs / 60_000);
    const allFailed = data.available === false;
    if (allFailed) return `Scanner: ERROR — all workers failed. Last heartbeat: ${ageMins} min ago.`;
    if (ageMins > 10) return `Scanner: DELAYED — last successful scan was ${ageMins} min ago.`;
    return `Scanner: ACTIVE — last successful scan ${ageMins} min ago. Frequent automated checks.`;
  } catch (e) {
    console.error("Scanner heartbeat fetch failed:", e);
    return "Scanner heartbeat: unavailable.";
  }
}
