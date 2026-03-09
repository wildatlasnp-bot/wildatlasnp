import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = ["https://wildatlasnp.lovable.app", "http://localhost:8080"];

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth guard: only accept calls from other edge functions via service role key
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, permitName, parkName, availableDates, recgovId, watchId } = await req.json();

    if (!to || !permitName) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'permitName'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    // Format dates concisely
    const dateStr = availableDates?.length
      ? availableDates.slice(0, 3).map((d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")
      : "Check site";

    // Build Recreation.gov direct booking link
    const bookingUrl = recgovId
      ? `https://www.recreation.gov/permits/${recgovId}`
      : "https://www.recreation.gov";

    // Build in-app deep link for the alert detail screen
    const appBaseUrl = "https://wildatlasnp.lovable.app";
    const alertParams = new URLSearchParams({
      permit: permitName,
      ...(parkName ? { park: parkName } : {}),
      ...(availableDates?.length ? { dates: availableDates.slice(0, 3).join(",") } : {}),
      url: bookingUrl,
      ...(watchId ? { wid: watchId } : {}),
    });
    const appAlertUrl = `${appBaseUrl}/alert?${alertParams.toString()}`;

    const body = `🐻 WildAtlas — ${permitName} permit available!\nDate: ${dateStr}\nBook now before it's gone:\n${appAlertUrl}\nReply STOP to unsubscribe.`;

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
