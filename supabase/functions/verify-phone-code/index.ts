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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { phone, code } = await req.json();
    if (!phone || !code || code.length !== 6) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Find the latest unexpired, unverified code for this user+phone
    const { data: verification, error: fetchErr } = await supabase
      .from("phone_verifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("phone_number", phone)
      .is("verified_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !verification) {
      return new Response(JSON.stringify({ error: "No valid code found. Please request a new one." }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check max attempts (5)
    if (verification.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Please request a new code." }), {
        status: 429,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Increment attempts
    await supabase
      .from("phone_verifications")
      .update({ attempts: verification.attempts + 1 })
      .eq("id", verification.id);

    // Verify code
    if (verification.code !== code) {
      return new Response(JSON.stringify({ error: "Incorrect code — please try again.", verified: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as verified
    await supabase
      .from("phone_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    // Update profile: set phone_verified = true and enable SMS
    await supabase
      .from("profiles")
      .update({ phone_verified: true, notify_sms: true })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-phone-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
