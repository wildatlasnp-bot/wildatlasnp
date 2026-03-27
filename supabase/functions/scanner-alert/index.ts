import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!cronSecret || token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
  const adminPhoneNumber = Deno.env.get("ADMIN_PHONE_NUMBER");

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber || !adminPhoneNumber) {
    console.error("[scanner-alert] Missing one or more required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, ADMIN_PHONE_NUMBER");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { reason } = body;
  const time = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const message = `🚨 WildAtlas Scanner Down\nReason: ${reason}\nTime: ${time}\nCheck Supabase logs immediately.`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        },
        body: new URLSearchParams({
          To: adminPhoneNumber,
          From: twilioPhoneNumber,
          Body: message,
        }).toString(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[scanner-alert] Twilio error ${res.status}: ${text}`);
      return new Response(JSON.stringify({ error: "Twilio request failed" }), { status: 500 });
    }

    console.log("[scanner-alert] SMS sent successfully");
    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (e) {
    console.error("[scanner-alert] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
