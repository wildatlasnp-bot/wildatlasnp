import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store the code
    await supabase.from("phone_verifications").insert({
      user_id: user.id,
      phone_number: phone,
      code,
    });

    // Send SMS via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

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

    console.log(`Verification code sent to ${phone}, SID: ${twilioResult.sid}`);
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
