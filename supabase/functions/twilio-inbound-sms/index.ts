import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

const OPT_OUT_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const OPT_IN_KEYWORDS  = new Set(["START", "UNSTOP"]);

const maskPhone = (phone: string) =>
  phone.length >= 4 ? `***-***-${phone.slice(-4)}` : "***";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const twimlResponse = new Response(TWIML_EMPTY, {
    status: 200,
    headers: { ...corsHeaders(req), "Content-Type": "text/xml; charset=utf-8" },
  });

  if (req.method !== "POST") return twimlResponse;

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const from = params.get("From") ?? "";
    const rawBody = params.get("Body") ?? "";
    const keyword = rawBody.trim().toUpperCase();

    if (!from) {
      console.log("[twilio-inbound-sms] Missing From field — ignoring");
      return twimlResponse;
    }

    const isOptOut = OPT_OUT_KEYWORDS.has(keyword);
    const isOptIn  = OPT_IN_KEYWORDS.has(keyword);

    if (!isOptOut && !isOptIn) return twimlResponse;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error } = await supabase
      .from("profiles")
      .update({ notify_sms: isOptIn })
      .eq("phone_number", from);

    if (error) {
      console.error("[twilio-inbound-sms] DB update failed:", error.message);
    } else {
      console.log(
        `[twilio-inbound-sms] ${isOptOut ? "Opt-out" : "Opt-in"} applied for ${maskPhone(from)} (keyword: ${keyword})`
      );
    }
  } catch (err) {
    console.error("[twilio-inbound-sms] Error:", err instanceof Error ? err.message : String(err));
  }

  return twimlResponse;
});
