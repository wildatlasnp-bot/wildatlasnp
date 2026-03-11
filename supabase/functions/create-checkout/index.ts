import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401,
      });
    }
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Invalid authorization format" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401,
      });
    }
    const token = authHeader.slice("Bearer ".length);
    if (!token) {
      return new Response(JSON.stringify({ error: "Empty authorization token" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401,
      });
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id });
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // 1) Try stored stripe_customer_id first
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;

    // 2) Fallback: search Stripe by email
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        // Store for future lookups
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
      }
    }

    // Guard: block duplicate subscriptions
    if (customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (existingSubs.data.length > 0) {
        logStep("User already has active subscription", { customerId });
        return new Response(
          JSON.stringify({ error: "already_subscribed", message: "You already have an active Pro subscription." }),
          { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    logStep("Customer lookup done", { customerId });

    const stripePriceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!stripePriceId) {
      logStep("ERROR: STRIPE_PRICE_ID env var not set");
      return new Response(JSON.stringify({ error: "Checkout unavailable — server misconfiguration" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 500,
      });
    }

    const appUrl = "https://wildatlasnp.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${appUrl}/success`,
      cancel_url: `${appUrl}/app?tab=sniper`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
