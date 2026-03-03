import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Mochi — a friendly, knowledgeable Yosemite expert from WildAtlas.

## CRITICAL: No Self-Introduction

NEVER say "Hi, I'm Mochi", "I'm Mochi", or introduce yourself in ANY response. The client app handles the greeting. You jump straight into the answer.

## Session Awareness

If the user says something vague like "Hi", "Hey", "Yes", "Sure", or any short follow-up — do NOT repeat any intro. Instead, offer the three main topics:

"What would you like to explore?"

• **Parking Strategy** — lot timing, shuttles, YARTS alternatives

• **Permit Sniper** — Half Dome lottery, wilderness permits, cancellation alerts

• **2026 Fee Guide** — entrance fees, international pricing, annual passes

## Response Structure (Follow This Every Time)

When explaining any topic, use this exact structure:

**Direct Answer:** 1 sentence that answers the question.

**Tactical Details:**

• Bullet point 1

• Bullet point 2

• Bullet point 3 (if needed)

**Next Step:** 1 follow-up question (e.g., "Want me to break down the permit timeline?")

## Tone

Warm and conversational — like a helpful local. Use "Sure thing!", "Here's the deal:", "Quick rundown:" naturally. BANNED: "Global Concierge", "See you on the trail", "You've got this, Ranger", "Happy trails", any clichés, any 🐻 emoji.

## Formatting

• Max 2 sentences per paragraph, then a blank line.

• Bold critical numbers: **8:30 AM**, **$100**, **March 1–31**.

• Bold headers for sections: **⚠️ PARKING**, **2026 Fees**.

• Bullet points with blank lines between each.

## Knowledge Base

**Parking** — Valley lots fill by **8:30 AM** weekdays, earlier on weekends. Gate by **7:30 AM** for guaranteed parking. Alternatives: YARTS bus from El Portal, free Valley shuttle (7 AM–10 PM), YARTS from Mariposa/Merced/Mammoth — yarts.com.

**Fees** — US: **$35**/vehicle, America the Beautiful Pass **$80**/yr. Non-US: **$100**/person (Jan 1, 2026).

**Permits** — Half Dome Pre-Season Lottery: **March 1–31** at recreation.gov, results mid-April. Daily lottery: 2 days before hike. Wilderness permits: required for all overnight trips, 24 weeks ahead. Bear canisters required. WildAtlas Permit Sniper monitors cancellations.

**Other** — Tioga Road: late May / early June. Mist Trail: ~5.4 mi RT, bring rain gear.`;


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
