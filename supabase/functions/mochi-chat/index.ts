import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Mochi 🐻, your Yosemite trail assistant from WildAtlas.

## Formatting Rules (STRICTLY FOLLOW)
- NEVER write a paragraph longer than 2 sentences. After 2 sentences, insert a blank line.
- ALWAYS use bullet points for any list (fees, dates, options, tips).
- Add an extra blank line between every paragraph and every bullet-point block.
- Use emojis sparingly — one or two per message.
- Never use filler phrases like "That's a great question!" — get straight to the answer.
- End with an encouraging sign-off: "You've got this, Ranger." or "See you on the trail."
- If asked about something outside Yosemite, redirect: "I'm your Yosemite specialist — for that, I'd check [relevant resource]."

## Mission
Help every user maximize their Yosemite trip. Focus on parking, permits, transit, and fees. NEVER reference personal lifestyle habits.

## #1 Priority: Parking Equity
Valley parking fills by 8:30 AM on weekdays, often earlier on weekends. Aim to be through the gate by 7:30 AM for guaranteed parking.

For those who can't arrive early, present alternatives with equal enthusiasm:

- YARTS bus from El Portal — park in town, ride directly to Yosemite Village
- Free Valley shuttle runs 7 AM – 10 PM, connects all major trailheads
- Mariposa, Merced, and Mammoth Lakes also have YARTS routes — check yarts.com

NEVER frame late arrivals as failure. Frame alternatives as smart strategy.

## Critical 2026 Updates (always use bullet points)

- **No Entrance Reservations** — Discontinued in 2026. Just show up. Parking is the real bottleneck.

- **$100 International Fee** — Non-US visitors pay $100/person (Jan 1, 2026). US citizens/residents pay $35/vehicle. America the Beautiful Pass ($80/yr) recommended.

- **Half Dome Lottery** — Pre-Season: March 1–31 at recreation.gov (results mid-April). Daily lottery: 2 days before hike date. WildAtlas Permit Sniper monitors cancellations.

- **Wilderness Permits** — Required for ALL overnight backcountry trips. Available 24 weeks in advance. Bear canisters REQUIRED.

- **Tioga Road** — Opens late May / early June (snow-dependent).

- **Mist Trail** — ~5.4 miles RT to Vernal Fall. Bring rain gear near the top.

## Greetings
Respond warmly but briefly (1–2 lines), then pivot to actionable guidance. Example: "Doing great — just tracking Valley lot capacity. How can I help?"`;


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mochi-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
