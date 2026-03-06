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
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Valley floor**: open, flat trails clear. Mirror Lake, Cook's Meadow, Lower Yosemite Fall loop all accessible.
- **Mist Trail**: icy above Vernal Fall footbridge — microspikes recommended.
- **Upper Yosemite Falls**: snow/ice above Columbia Rock — traction devices required.
- **Glacier Point / Panorama Trail**: closed (road gated at Badger Pass).
- **Mariposa Grove**: snowshoe access only, road closed to vehicles.
- Waterfalls: **low flow** Dec–Feb, picking up in March.
- Sunset: ~**5:00 PM**. Plan to finish hikes by **4 PM**.

### Spring (Apr–May)
- **Mist Trail**: open but very wet — waterproof layers essential. Peak waterfall flow **mid-May to early June**.
- **Upper Yosemite Falls**: snow patches above Columbia Rock into May.
- **Valley floor**: all trails open. Wildflowers peak **late April–May**.
- **Glacier Point Road**: typically opens **late May** (weather dependent).
- **Tioga Road**: closed until **late May–June**.
- Sunset: ~**7:30–8:00 PM**.

### Summer (Jun–Sep)
- All trails open. **Half Dome cables up mid-May through mid-Oct** (permit required).
- **Mist Trail**: dry by July, crowded — start by **7 AM**.
- **Tioga Road & Tuolumne Meadows**: open. Great high-country hiking.
- Heat advisory: Valley temps reach **95–105°F** Jul–Aug. Carry 3L water minimum.
- Waterfalls: **dry by August** except Vernal Fall (reduced).
- Sunset: ~**8:30 PM**. Golden hour at Glacier Point starts ~**7 PM**.

### Fall (Oct–Nov)
- **Half Dome cables**: down by **mid-October**.
- Valley trails: open, uncrowded. Fall color peaks **late October**.
- **Glacier Point Road**: closes for season **early November**.
- **Tioga Road**: closes with first major snowfall, usually **late October**.
- Waterfalls: minimal flow. Horsetail Fall "firefall" effect: **mid-February only**.
- Sunset: ~**5:30–6:30 PM**.`,
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
- Mowich Lake: primitive camping, no reservations needed

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Paradise trails**: snowshoe/cross-country ski only. Nisqually Vista loop popular.
- **Skyline Trail**: buried under snow — not hikeable.
- **Grove of the Patriarchs**: closed (bridge damage, check NPS for updates).
- **Carbon River Trail**: open for low-elevation rainforest walks.
- Road access: only **Nisqually entrance to Paradise** open (chains required).
- Sunrise, Mowich, Carbon River roads: **closed**.
- Sunset: ~**4:30 PM**. Start snowshoe trips by **1 PM**.

### Spring (Apr–Jun)
- **Paradise**: snow lingers through June. Snowshoes needed until late May.
- **Skyline Trail**: partially snow-covered into **mid-July** most years.
- **Rampart Ridge / Trail of the Shadows**: snow-free by **late April**.
- **Wonderland Trail**: not fully passable until **mid-July**.
- Wildflowers at Paradise: peak **late July–early August** (not spring).
- Sunrise Road: opens **late June–early July**.

### Summer (Jul–Sep)
- All major trails open. **Paradise wildflower meadows peak late July–mid-August**.
- **Skyline Trail**: fully open, best views of Rainier. Start by **8 AM** to beat clouds.
- **Sunrise area**: open Jul–Sep. Burroughs Mountain for alpine tundra.
- **Camp Muir**: snow travel — ice axe and crampons recommended above Muir Snowfield.
- **Wonderland Trail**: full 93-mile loop hikeable. Permit required.
- Heat: rare — temps at Paradise **55–70°F**. Valley temps **80–90°F**.
- Sunset: ~**8:45 PM**. Alpenglow on Rainier starts ~**8 PM**.

### Fall (Oct–Nov)
- **Paradise**: trails open but snow possible by mid-October.
- **Sunrise Road**: closes **early October**.
- Fall color: **late September–mid-October** at lower elevations.
- **Grove of the Patriarchs**: check NPS for bridge status.
- First snow at Paradise: typically **mid-October**.
- Sunset: ~**5:30–6:00 PM**.`,
  },
};

const DEFAULT_PARK = "yosemite";

// ── Live data fetchers ──────────────────────────────────────────────

async function fetchNPSAlerts(parkId: string, parkName: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
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

  return `You are Mochi — a knowledgeable park guide for ${park.name}, built into the WildAtlas app.
You speak like a friend who happens to be a park ranger — someone who's spent years on these trails and genuinely wants visitors to have the best experience. You're warm but practical, specific but never overwhelming.

Your current park is **${park.name}**. Stay focused on this park unless the user asks about another.

## Voice & Tone
- Talk like a ranger giving trailhead advice to a friend. Not a pamphlet.
- Lead with a clear recommendation. Commit to ONE best option.
- Use short, punchy ranger-style language. "Parking easy today" not "Lots won't fill up during this off-season Thursday."
- Be honest about uncertainty. "Hard to say, but based on the forecast…" beats false confidence.
- Never use: "Happy trails", "See you out there", "Great question!", "I'd be happy to help", "Here's what I found", or any stock AI phrases.
- Never introduce yourself. The app handles that.
- No emojis in body text. Okay in section headers only.

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
- When asked "should I drive in tomorrow?" — give a clear YES/NO, the forecast, and one concrete tip.
- When asked about permits — reference the user's ACTUAL watch status above.
- When asked about weather — use the ACTUAL NWS forecast and translate to practical advice.
- When asked about parking — use the ACTUAL time-based estimate with a specific arrival time.
- Bold all critical numbers: times, temperatures, place names.
- If data says "unavailable", say so and suggest nps.gov.
- Never guess when you have data. Cite it.

## Response Format — CRITICAL
Users scan on a phone in bright sunlight. Be decisive, not encyclopedic.

### Structure (every response follows this)
1. **Recommendation** — one decisive sentence under 12 words. This IS the answer.
   Example: "Go to the Valley floor today — waterfalls near peak."
2. **Ranked list** (when asking "where/what") — numbered top picks, 1 line each.
   Example:
   **Best spots today**
   1. **Lower Yosemite Fall** loop
   2. **Cook's Meadow** for Half Dome views
   3. **Mirror Lake** for reflections
3. **One optional context section** — only if it's directly safety-relevant to the primary answer.
4. **No closing line** unless it adds a specific time/place the user needs.

### Section limit — STRICT: MAX 2 SECTIONS
- Section 1: **Primary answer** — directly answers the user's question.
- Section 2 (optional): **Watch for** or **Also note** — only if there's a safety/timing concern tied to the answer.
- NEVER add unrelated sections. If the user asks about weather, do NOT add trails, parking, or permits.
- If the user asks about parking, do NOT add weather or trails unless road conditions affect access.

### Allowed section headers (pick max 2 per response)
🌤 **Conditions** · 🚗 **Roads** · 🅿️ **Parking** · 👥 **Crowds** · 🥾 **Trails** · 🎫 **Permits** · 🌅 **Sunset** · ⚠️ **Watch for**

### Bullet rules — STRICT (MOST IMPORTANT RULE)
- **ONE single fact per bullet.** If a bullet contains "and", a comma joining two facts, or a semicolon — SPLIT IT.
- Format each bullet as: "Label: **value**" or "**Place** detail".
- Max **10 words** per bullet. Anything longer MUST be split.
- Max **3 bullets** per section.
- Use "•" character.
- **Bold** all numbers, temperatures, times, and place names.

GOOD (one fact, label+value, bold numbers):
• High tomorrow: **55°F**
• Night low: **33°F**
• **Mist Trail**: icy — microspikes needed
• Parking fills by **8:30 AM**

BAD (multiple facts crammed together — NEVER DO THIS):
• Friday hits a high of 55°F and night lows reach 33°F.
• It's currently 27°F and expected to reach 55°F tomorrow with icy conditions on Mist Trail.
• Parking fills by 8:30 AM on weekdays but earlier on weekends, aim for 7 AM.

### Phrasing rules
- Ranger shorthand over full sentences.
- "Parking easy today" not "Lots won't fill up during this off-season Thursday."
- "Tioga Road closed" not "Tioga Road is currently closed for the season."

### Length
- Target **40–60 words**. Never exceed **80 words** unless user asks for detail.
- If the answer is simple, 20 words is fine.

### Topic focus — CRITICAL
- Answer ONLY what was asked. Nothing else.
- "What's the weather?" → weather only. No trails, no parking, no permits.
- "Should I go tomorrow?" → yes/no + weather + one relevant context (e.g. road closure).
- Only combine topics if the user explicitly asks multiple questions.`;

}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        userId = data.claims.sub as string;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Server-side rate limiting: 10 requests per 60 seconds per user ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countErr } = await adminClient
      .from("api_health_log")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", `mochi-chat/${userId}`)
      .gte("created_at", oneMinuteAgo);

    if (!countErr && (count ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log this request for rate limiting
    await adminClient.from("api_health_log").insert({
      endpoint: `mochi-chat/${userId}`,
      status_code: 200,
      response_time_ms: 0,
    });

    const { messages, arrivalDate, parkId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const park = PARK_META[parkId] ?? PARK_META[DEFAULT_PARK];

    // Fetch all live data in parallel
    const [weather, alerts, permits] = await Promise.all([
      fetchWeather(park.lat, park.lon),
      fetchNPSAlerts(parkId ?? DEFAULT_PARK, park.name),
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
