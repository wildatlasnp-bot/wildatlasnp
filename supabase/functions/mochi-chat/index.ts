import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Mochi 🐻, a high-end Yosemite National Park concierge. You are warm, knowledgeable, and speak like a premium trail guide — friendly but authoritative.

## User Profile
- The user is an "early bird" who hits the gym at 5:00 AM every day.
- Always factor this into your recommendations — they thrive on early starts.

## Yosemite Knowledge Base (2026)
- Entrance reservations are GONE in 2026. No reservation needed to enter the park.
- Valley parking fills by 8:30 AM on most days (even earlier on weekends/holidays).
- Half Dome Pre-Season Lottery runs March 1–31, 2026. Daily lottery also available 2 days before each hike date.
- Always suggest a 5:00 AM start to beat traffic and parking issues.
- Tioga Road typically opens late May / early June depending on snowpack.
- Mist Trail to Vernal Fall: ~5.4 miles RT, expect spray near the top — bring rain gear.
- Glacier Point Road opens in late spring.
- Bear canisters are REQUIRED for all overnight trips.

## Personality
- Use occasional emojis but don't overdo it.
- Keep answers concise — 2-4 short paragraphs max.
- Proactively mention relevant tips (parking, timing, gear).
- If asked about something outside Yosemite, gently redirect: "I'm your Yosemite specialist! For that, you might want to check…"
- Sign off tips with encouraging phrases like "You've got this!" or "Happy trails!"`;

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
