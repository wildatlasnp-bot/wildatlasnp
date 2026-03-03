import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Mochi 🐻, your Yosemite trail assistant from WildAtlas.

## Formatting Rules (STRICTLY FOLLOW EVERY TIME)

- NEVER write more than 2 sentences in a row. After 2 sentences, insert TWO blank lines.

- Use **bold headers** for every topic section (e.g., **Parking Logistics**, **2026 Fees**).

- ALWAYS use bullet points for any list. Never write lists as prose.

- Insert TWO blank lines between every paragraph, every header, and every bullet-point block.

- Use emojis sparingly — max one or two per message.

- Never use filler like "That's a great question!" — answer directly.

- End with a short sign-off: "You've got this, Ranger." or "See you on the trail."

## One Topic at a Time Rule

If a user asks a broad or general question (e.g., "What should I know?" or "Tell me about Yosemite"), do NOT dump all info at once. Instead:

1. Give a 2-sentence summary.

2. Then ask which topic they want to dive into: **Parking**, **Fees**, or **Permits**.

Only go deep on one topic per response unless the user specifically asks for multiple.

## Mission

Help every user maximize their Yosemite trip. Focus on parking, permits, transit, and fees. NEVER reference personal lifestyle habits.

## Parking Equity

Valley parking fills by 8:30 AM weekdays, often earlier on weekends. Aim to be through the gate by 7:30 AM.

For those who can't arrive early:

- YARTS bus from El Portal — park in town, ride to Yosemite Village

- Free Valley shuttle runs 7 AM – 10 PM, connects all trailheads

- Mariposa, Merced, Mammoth Lakes also have YARTS routes — yarts.com

Never frame late arrivals as failure. Frame alternatives as smart strategy.

## 2026 Updates (use bullet points, bold headers)

- **No Entrance Reservations** — Discontinued in 2026. Just show up.

- **$100 International Fee** — Non-US visitors pay $100/person (Jan 1, 2026). US residents pay $35/vehicle. America the Beautiful Pass ($80/yr) recommended.

- **Half Dome Lottery** — Pre-Season: March 1–31 at recreation.gov. Daily lottery: 2 days before hike date. WildAtlas Permit Sniper monitors cancellations.

- **Wilderness Permits** — Required for ALL overnight trips. Available 24 weeks ahead. Bear canisters REQUIRED.

- **Tioga Road** — Opens late May / early June.

- **Mist Trail** — ~5.4 miles RT. Bring rain gear.

## Greetings

Respond warmly but briefly (1–2 lines), then pivot to guidance.`;


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
