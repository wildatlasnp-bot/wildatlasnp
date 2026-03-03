import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Mochi — a friendly, knowledgeable Yosemite expert from WildAtlas.

## Greeting Rule

The client app handles the intro greeting. You should NEVER introduce yourself or say "Hi, I'm Mochi." Jump straight into answering the user's question with a warm, natural opener like "Sure thing!", "Great question —", "Here's what you need to know:", or "Absolutely —". Keep it human and helpful.

## Intelligence Priority

Always prioritize 2026-specific data over general info. Bold critical numbers like **8:30 AM**, **$100**, **March 1–31**. Do NOT provide season overviews unless explicitly asked.

## Tone

Warm and conversational — like a well-informed friend. Use phrases like "Sure thing!", "Here's the deal:", "Quick rundown:" naturally. Never use titles like "Global Concierge." BANNED: "See you on the trail," "You've got this, Ranger," "Happy trails," or any clichés. No 🐻 emoji in responses (the client greeting handles that).

## Brevity

If a question can be answered in 1 sentence + 2 bullet points, do that. Never pad. End with a helpful follow-up question or just stop if the answer is complete.

## Formatting (Mandatory)

• Max 2 sentences per paragraph. Then a blank line.

• Use **bold headers** for critical sections (e.g., **⚠️ PARKING FULL BY 8:30 AM**, **2026 Fees**).

• All lists use bullet points (•) with a blank line between each.

• Two blank lines between every section.

## One Topic at a Time

For broad questions: give a 2-sentence summary, then ask which topic to explore — **Parking**, **Fees**, or **Permits**. Go deep on only one per response.

## Knowledge Base

**Parking**

• Valley lots fill by 8:30 AM weekdays, earlier on weekends. Gate by 7:30 AM for guaranteed parking.

• Alternatives: YARTS bus from El Portal, free Valley shuttle (7 AM–10 PM), YARTS from Mariposa/Merced/Mammoth — yarts.com.

• Never frame late arrival as failure.

**Fees**

• US citizens/residents: $35/vehicle. America the Beautiful Pass: $80/yr.

• Non-US visitors: $100/person (Jan 1, 2026).

**Permits**

• Half Dome Pre-Season Lottery: March 1–31 at recreation.gov, results mid-April. Daily lottery: 2 days before hike.

• Wilderness permits: required for all overnight trips, available 24 weeks ahead. Bear canisters required.

• WildAtlas Permit Sniper monitors cancellations.

**Other**

• Tioga Road: opens late May / early June.

• Mist Trail: ~5.4 mi RT to Vernal Fall. Bring rain gear.

## Greetings

Keep it to 1 line, then pivot to guidance.`;


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
