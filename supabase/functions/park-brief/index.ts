// Lovable Cloud edge function: park-brief
// Generates a single-sentence "Poko's read on today" brief per park, cached 1h per park-hour bucket.
// Strict zero-hallucination policy: brief is built from real signals (forecast + finds + alerts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PARK_TZ: Record<string, string> = {
  yosemite: "America/Los_Angeles",
  rainier: "America/Los_Angeles",
  zion: "America/Denver",
  glacier: "America/Denver",
  rocky_mountain: "America/Denver",
  arches: "America/Denver",
  grand_canyon: "America/Phoenix",
  grand_teton: "America/Denver",
};

const PARK_NAMES: Record<string, string> = {
  yosemite: "Yosemite",
  rainier: "Mount Rainier",
  zion: "Zion",
  glacier: "Glacier",
  rocky_mountain: "Rocky Mountain",
  arches: "Arches",
  grand_canyon: "Grand Canyon",
  grand_teton: "Grand Teton",
};

function getCurrentSeason(tz: string): "spring" | "summer" | "fall" | "winter" {
  const month = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric" }).format(new Date()),
    10,
  );
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function getDayType(tz: string): "weekday" | "weekend" {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date());
  return wd === "Sat" || wd === "Sun" ? "weekend" : "weekday";
}

function getLocalHour(tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(
      new Date(),
    ),
    10,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { parkId } = await req.json();
    if (!parkId || typeof parkId !== "string") {
      return new Response(JSON.stringify({ error: "parkId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tz = PARK_TZ[parkId] ?? "America/Los_Angeles";
    const parkName = PARK_NAMES[parkId] ?? parkId;
    const localHour = getLocalHour(tz);
    const season = getCurrentSeason(tz);
    const dayType = getDayType(tz);
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const bucketKey = `${localDate}-${localHour}-${dayType}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Cache check
    const { data: cached } = await supabase
      .from("park_brief_cache")
      .select("brief, signals, expires_at")
      .eq("park_id", parkId)
      .eq("bucket_key", bucketKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ brief: cached.brief, signals: cached.signals, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Gather signals (zero-hallucination — only real data feeds the prompt)
    const [forecastRes, findsRes, alertsRes] = await Promise.all([
      supabase
        .from("park_crowd_forecasts")
        .select("location_name, quiet_start, quiet_end, peak_start, peak_end, evening_quiet")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("display_order")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("recent_finds")
        .select("permit_name, location_name, found_at")
        .eq("park_id", parkId)
        .gte("found_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("found_at", { ascending: false })
        .limit(3),
      supabase
        .from("park_alerts")
        .select("title, category")
        .eq("park_id", parkId)
        .order("last_updated", { ascending: false })
        .limit(2),
    ]);

    const forecast = forecastRes.data;
    const finds = findsRes.data ?? [];
    const alerts = alertsRes.data ?? [];

    const signals = {
      localHour,
      season,
      dayType,
      forecast: forecast
        ? {
            location: forecast.location_name,
            quiet: `${forecast.quiet_start}–${forecast.quiet_end}`,
            peak: `${forecast.peak_start}–${forecast.peak_end}`,
            eveningQuiet: forecast.evening_quiet,
          }
        : null,
      findsLast24h: finds.length,
      latestFind: finds[0]
        ? { name: finds[0].permit_name, location: finds[0].location_name }
        : null,
      latestAlert: alerts[0] ? { title: alerts[0].title, category: alerts[0].category } : null,
    };

    // 3. Lovable AI Gateway — single-sentence brief, no markdown
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are Poko, an AI park companion. Write ONE concise sentence (max 28 words) summarizing right-now conditions at ${parkName}. 
Strict rules:
- Use ONLY facts from the signals provided. Never invent weather, temps, road status, or events not in signals.
- Plain prose only. No markdown, no bullets, no emoji, no quotes.
- Honest tone — never hyperbolic. No words like "amazing", "perfect", "best ever".
- If signals are sparse, write a brief based on time of day and season only (e.g. "Late afternoon in fall — typical quiet window opens after 5pm.").
- Reference the local hour (${localHour}:00) and ${dayType} when relevant.`;

    const userPrompt = `Signals for ${parkName} right now:\n${JSON.stringify(signals, null, 2)}\n\nWrite the one-sentence brief.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached, try again in a moment.", signals }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted.", signals }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway failed", signals }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResponse.json();
    let brief: string = aiJson?.choices?.[0]?.message?.content?.trim() ?? "";
    // Sanitize: strip markdown artifacts and quotes
    brief = brief
      .replace(/^["']|["']$/g, "")
      .replace(/^\*+|\*+$/g, "")
      .replace(/[*_`#]/g, "")
      .trim();

    if (!brief) {
      return new Response(JSON.stringify({ error: "Empty brief", signals }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Cache (upsert in case of race)
    await supabase
      .from("park_brief_cache")
      .upsert(
        {
          park_id: parkId,
          bucket_key: bucketKey,
          brief,
          signals,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "park_id,bucket_key" },
      );

    return new Response(JSON.stringify({ brief, signals, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("park-brief error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
