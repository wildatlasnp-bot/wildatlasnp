import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth guard — fail-closed: 500 if env missing, 401 if token wrong/absent
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const { to, permitName, parkName, availableDates, recgovId, watchId } = await req.json();

    if (!to || !permitName) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'permitName'" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
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
    const appBaseUrl = Deno.env.get("APP_URL") ?? "https://wildatlas.app";
    const alertParams = new URLSearchParams({
      permit: permitName,
      ...(parkName ? { park: parkName } : {}),
      ...(availableDates?.length ? { dates: availableDates.slice(0, 3).join(",") } : {}),
      url: bookingUrl,
      ...(watchId ? { wid: watchId } : {}),
    });
    const appAlertUrl = `${appBaseUrl}/alert?${alertParams.toString()}`;

    const body = `WildAtlas — Availability detected for ${permitName}\nDate: ${dateStr}\nCheck Recreation.gov to confirm:\n${appAlertUrl}\nReply STOP to unsubscribe.`;

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
      signal: AbortSignal.timeout(10_000),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", result);
      return new Response(
        JSON.stringify({ error: result.message || "Twilio API error", code: result.code }),
        { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`SMS sent to ${to.slice(-4).padStart(to.length, "*")} for ${permitName}, SID: ${result.sid}`);
    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-sms error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
