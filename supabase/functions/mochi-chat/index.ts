import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Park configs for live data fetching ─────────────────────────────

interface ParkMeta {
  name: string;
  npsCode: string;
  lat: number;
  lon: number;
  timezone: string;
  parkingContext: () => string;
  knowledge: string;
}

const PARK_META: Record<string, ParkMeta> = {
  yosemite: {
    name: "Yosemite National Park",
    npsCode: "yose",
    lat: 37.7456,
    lon: -119.5936,
    timezone: "America/Los_Angeles",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 5 && month <= 10;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Nov–Apr): Valley parking rarely fills.";
      return `Peak season (May–Oct). Valley lots typically fill by 8:30 AM weekdays, earlier on weekends. ${isWeekend ? "TODAY IS A WEEKEND — expect earlier fill times." : "Weekday — slightly better odds."} Alternatives: YARTS bus from El Portal ($6), Mariposa ($12), Merced ($18). Free Valley shuttle 7 AM–10 PM. Afternoon turnover typically 2–3 PM.`;
    },
    knowledge: `## Parking Knowledge
- Valley lots fill by **8:30 AM** weekdays, **7:30 AM** weekends in peak season (May–Oct)
- YARTS bus: El Portal ($6), Mariposa ($12), Merced ($18) — yarts.com
- Free Valley shuttle: 7 AM–10 PM
- Afternoon turnover window: **2–3 PM**

## Permit Knowledge
- Half Dome pre-season lottery: **March 1–31** at recreation.gov, results mid-April
- Daily lottery: 2 days before hike date
- Wilderness permits: required year-round for overnights, reservable 24 weeks ahead
- WildAtlas Permit Sniper monitors Recreation.gov for cancellations in real-time

## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)`,
  },
  rainier: {
    name: "Mount Rainier National Park",
    npsCode: "mora",
    lat: 46.8523,
    lon: -121.7603,
    timezone: "America/Los_Angeles",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 6 && month <= 9;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Oct–May): Paradise and Sunrise lots rarely fill. Some roads may be closed.";
      return `Peak season (Jun–Sep). Paradise lot fills by 10 AM on weekends, 11 AM weekdays. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 9 AM." : "Weekday — better odds but still fills midday."} No shuttle service — driving is the only option. Timed entry reservations required on peak weekends.`;
    },
    knowledge: `## Parking Knowledge
- Paradise lot fills by **10 AM** weekends, **11 AM** weekdays in peak season (Jun–Sep)
- Sunrise lot fills by **11 AM** on weekends
- No shuttle service available — personal vehicle or carpool only
- Timed entry reservations required on peak summer weekends

## Permit Knowledge
- Wonderland Trail: lottery opens **March 1**, results mid-April. 70% lottery, 30% walk-up
- Camp Muir: no permit required for day hikes, climbing permit required above Muir
- Wilderness Camping: required year-round for backcountry overnights, reservable starting March 1
- WildAtlas Permit Sniper monitors Recreation.gov for cancellations in real-time

## Fees (2026)
- US vehicles: **$30**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Key Routes
- Paradise: most popular, open year-round (chains required in winter)
- Sunrise: highest drive-to point, open Jul–Sep
- Carbon River: rainforest access, limited facilities
- Mowich Lake: primitive camping, no reservations needed`,
  },
};

const DEFAULT_PARK = "yosemite";

// ── Live data fetchers ──────────────────────────────────────────────

async function fetchNPSAlerts(npsCode: string, parkName: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.nps.gov/api/v1/alerts?parkCode=${npsCode}&limit=10`,
      { headers: { "User-Agent": "WildAtlas/1.0" } }
    );
    if (!res.ok) return "NPS alerts unavailable.";
    const json = await res.json();
    const alerts = json.data ?? [];
    if (alerts.length === 0) return `No active NPS alerts for ${parkName}.`;
    return alerts
      .slice(0, 5)
      .map((a: any) => `[${a.category}] ${a.title}: ${a.description?.slice(0, 200)}`)
      .join("\n");
  } catch (e) {
    console.error("NPS alerts fetch failed:", e);
    return "NPS alerts unavailable.";
  }
}

async function fetchWeather(lat: number, lon: number): Promise<string> {
  try {
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: { "User-Agent": "WildAtlas/1.0", Accept: "application/geo+json" } }
    );
    if (!pointRes.ok) return "Weather data unavailable.";
    const pointData = await pointRes.json();
    const forecastUrl = pointData.properties?.forecast;
    if (!forecastUrl) return "Weather forecast URL not found.";

    const forecastRes = await fetch(forecastUrl, {
      headers: { "User-Agent": "WildAtlas/1.0", Accept: "application/geo+json" },
    });
    if (!forecastRes.ok) return "Weather forecast unavailable.";
    const forecastData = await forecastRes.json();
    const periods = forecastData.properties?.periods ?? [];
    return periods
      .slice(0, 4)
      .map(
        (p: any) =>
          `${p.name}: ${p.temperature}°${p.temperatureUnit}, ${p.shortForecast}. Wind ${p.windSpeed} ${p.windDirection}.`
      )
      .join("\n");
  } catch (e) {
    console.error("Weather fetch failed:", e);
    return "Weather data unavailable.";
  }
}

async function fetchPermitStatus(userId: string | null, parkId: string): Promise<string> {
  if (!userId) return "No permit watches configured (user not identified).";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("active_watches")
      .select("permit_name, status, is_active")
      .eq("user_id", userId)
      .eq("park_id", parkId);
    if (!data || data.length === 0) return "No permit watches active for this park.";
    return data
      .map(
        (w: any) =>
          `• ${w.permit_name}: ${w.is_active ? "MONITORING" : "paused"} (status: ${w.status})`
      )
      .join("\n");
  } catch (e) {
    console.error("Permit status fetch failed:", e);
    return "Permit status unavailable.";
  }
}

// ── System prompt builder ───────────────────────────────────────────

function buildSystemPrompt(
  park: ParkMeta,
  weather: string,
  alerts: string,
  parking: string,
  permits: string,
  arrivalDate: string | null
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: park.timezone,
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: park.timezone,
  });

  return `You are Mochi — a data-driven ${park.name} logistics assistant from WildAtlas.
You give direct, tactical answers backed by the LIVE DATA below. Never guess when you have data. Cite the data.
Your current park context is **${park.name}**. Only answer questions about this park unless the user explicitly asks about another.

## Current Time
${dateStr}, ${timeStr} (${park.timezone})

${arrivalDate ? `## User's Planned Arrival\n${arrivalDate}\n` : ""}

## LIVE WEATHER (National Weather Service)
${weather}

## LIVE NPS ALERTS
${alerts}

## PARKING CONTEXT
${parking}

## USER'S PERMIT WATCHES
${permits}

${park.knowledge}

## CRITICAL RULES
- NEVER say "Hi, I'm Mochi" or introduce yourself. The client app handles greetings.
- When asked "should I drive in tomorrow?" — answer with the SPECIFIC weather forecast for tomorrow, the expected parking fill time, and a clear YES/NO recommendation with reasoning.
- When asked about permits — reference the user's ACTUAL watch status above.
- When asked about weather — use the ACTUAL NWS forecast above, not generic advice.
- When asked about parking — use the ACTUAL time-based estimate above.
- Bold all critical numbers: times, temperatures, percentages.
- If data says "unavailable", say so honestly and suggest checking nps.gov.

## Response Structure
1. **Direct answer** — 1 sentence, data-backed
2. **Key data points** — 2-4 bullets with specific numbers from the live data
3. **Recommendation** — concrete action

## Tone
Direct and efficient. Like a well-informed ranger, not a chatbot. No emojis except when listing options. No clichés ("Happy trails", "See you out there").`;
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId, arrivalDate, parkId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const park = PARK_META[parkId] ?? PARK_META[DEFAULT_PARK];

    // Fetch all live data in parallel
    const [weather, alerts, permits] = await Promise.all([
      fetchWeather(park.lat, park.lon),
      fetchNPSAlerts(park.npsCode, park.name),
      fetchPermitStatus(userId, parkId ?? DEFAULT_PARK),
    ]);
    const parking = park.parkingContext();

    console.log(`[${parkId}] Live data fetched — weather: ${weather.slice(0, 80)} | alerts: ${alerts.slice(0, 80)}`);

    const systemPrompt = buildSystemPrompt(park, weather, alerts, parking, permits, arrivalDate);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mochi-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
