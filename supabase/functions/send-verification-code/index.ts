import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

const missingVars = [
  !accountSid && "TWILIO_ACCOUNT_SID",
  !authToken && "TWILIO_AUTH_TOKEN",
  !fromNumber && "TWILIO_PHONE_NUMBER",
].filter(Boolean);

if (missingVars.length > 0) {
  console.error("SMS service misconfigured — missing env vars:", missingVars.join(", "));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (missingVars.length > 0) {
    return new Response(
      JSON.stringify({ error: "SMS service misconfigured — contact support" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { phone } = await req.json();
    if (!phone || !/^\+1\d{10}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid US phone number" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Per-IP rate limit: max 10 SMS sends per IP per hour
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    if (!ip) {
      console.warn("SMS_IP_UNKNOWN user_id=%s — proceeding without IP rate limit", user.id);
    } else {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: ipCount } = await supabase
        .from("sms_ip_rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", windowStart);

      if ((ipCount ?? 0) >= 10) {
        console.warn("SMS_IP_RATE_LIMITED ip=%s user_id=%s", ip, user.id);
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Record this attempt before sending (counts attempts, not just successes)
      await supabase.from("sms_ip_rate_limits").insert({ ip });
      // Opportunistic prune — non-blocking, ignore errors
      supabase.rpc("prune_sms_ip_rate_limits").then(() => {}, () => {});
    }

    // Rate limit: max 3 codes per phone per hour
    const { count } = await supabase
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit code
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(100000 + (buf[0] % 900000));

    // Store the code
    await supabase.from("phone_verifications").insert({
      user_id: user.id,
      phone_number: phone,
      code,
    });

    // Send SMS via Twilio
    const params = new URLSearchParams();
    params.set("To", phone);
    params.set("From", fromNumber);
    params.set("Body", `Your WildAtlas verification code is: ${code}. It expires in 10 minutes.`);

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const twilioResult = await twilioRes.json();
    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioResult);
      return new Response(JSON.stringify({ error: "Failed to send SMS" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log(`Verification code sent to ${phone.slice(-4).padStart(phone.length, "*")}, SID: ${twilioResult.sid}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-verification-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
