import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, permitName, parkName, availableDates } = await req.json();

    if (!to || !permitName) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'permitName'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const datePreview = availableDates?.length
      ? `\nDates: ${availableDates.slice(0, 3).map((d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")}`
      : "";

    const body = `🎯 WildAtlas Alert: ${permitName} permit just opened${parkName ? ` at ${parkName}` : ""}!${datePreview}\n\nBook NOW on Recreation.gov before it's gone.`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", fromNumber);
    params.set("Body", body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: params.toString(),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", result);
      return new Response(
        JSON.stringify({ error: result.message || "Twilio API error", code: result.code }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`SMS sent to ${to} for ${permitName}, SID: ${result.sid}`);
    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-sms error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
