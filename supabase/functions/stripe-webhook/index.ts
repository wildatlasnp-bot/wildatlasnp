import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    logStep("ERROR", { message: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR", { message: "Missing stripe-signature header" });
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { message: msg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Helper: sync is_pro status for a Stripe customer (never throws)
    const syncProStatus = async (customerId: string, isPro: boolean) => {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !("email" in customer) || !customer.email) {
          logStep("Customer not found or deleted", { customerId });
          return;
        }

        const email = customer.email;
        logStep("Syncing is_pro", { email, isPro });

        // Look up user by email
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserByEmail(email);
        if (userError || !userData?.user) {
          logStep("No matching auth user found — skipping sync", { email, error: userError?.message });
          return;
        }

        // Upsert profile so missing rows don't crash
        const { error: upsertError } = await supabaseClient
          .from("profiles")
          .upsert(
            { user_id: userData.user.id, is_pro: isPro },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          logStep("Failed to upsert profile", { message: upsertError.message });
        } else {
          logStep("Successfully synced is_pro", { userId: userData.user.id, isPro });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logStep("syncProStatus error (non-fatal)", { customerId, message: msg });
      }
    };

    // Handle relevant events — each wrapped in try/catch so we never crash
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          logStep(`Processing ${event.type}`, { customerId: subscription.customer, status: subscription.status });
          await syncProStatus(subscription.customer as string, isActive);
          logStep(`handled ${event.type}`);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep(`Processing ${event.type}`, { customerId: subscription.customer });
          await syncProStatus(subscription.customer as string, false);
          logStep(`handled ${event.type}`);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep(`Processing ${event.type}`, { customerId: invoice.customer, subscriptionId: invoice.subscription });
          if (invoice.customer && invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            const isActive = subscription.status === "active" || subscription.status === "trialing";
            await syncProStatus(invoice.customer as string, isActive);
          } else {
            logStep("Payment succeeded (no subscription attached — skipping)", { customerId: invoice.customer });
          }
          logStep(`handled ${event.type}`);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment failed — will wait for subscription status change", { customerId: invoice.customer });
          logStep(`handled ${event.type}`);
          break;
        }

        default:
          logStep("Unhandled event type (ignored)", { type: event.type });
      }
    } catch (handlerError) {
      const msg = handlerError instanceof Error ? handlerError.message : String(handlerError);
      logStep(`error handling ${event.type}: ${msg}`);
    }

    // Always return 200 so Stripe does not retry indefinitely
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Only reaches here if signature verification or body parsing fails
    const msg = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR", { message: msg });
    return new Response(JSON.stringify({ received: true, warning: "processing error logged" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
