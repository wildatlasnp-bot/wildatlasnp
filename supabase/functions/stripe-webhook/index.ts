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

    // ── Helpers ──────────────────────────────────────────────────────────

    /** Resolve a Stripe customer ID → Supabase user ID, linking stripe_customer_id if missing. Never throws. */
    const resolveUser = async (customerId: string) => {
      try {
        // 1) Fast path: look up by stored stripe_customer_id
        const { data: byStripeId } = await supabaseClient
          .from("profiles")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (byStripeId?.user_id) return byStripeId.user_id as string;

        // 2) Fallback: fetch email from Stripe, then look up auth user
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !("email" in customer) || !customer.email) {
          logStep("Customer not found or deleted", { customerId });
          return null;
        }

        const email = customer.email;
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserByEmail(email);
        if (userError || !userData?.user) {
          logStep("No matching auth user found", { email, error: userError?.message });
          return null;
        }

        // Link stripe_customer_id for future lookups
        await supabaseClient
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userData.user.id);

        logStep("Linked stripe_customer_id to user", { userId: userData.user.id, customerId });
        return userData.user.id as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logStep("resolveUser error (non-fatal)", { customerId, message: msg });
        return null;
      }
    };

    /** Sync is_pro status (and optional renewal date) for a resolved user. Never throws. */
    const syncProStatus = async (userId: string, isPro: boolean, subscriptionEnd?: number | null) => {
      try {
        const updates: Record<string, unknown> = { is_pro: isPro };
        if (subscriptionEnd != null) {
          updates.subscription_end = new Date(subscriptionEnd * 1000).toISOString();
        } else if (!isPro) {
          updates.subscription_end = null;
        }
        const { error } = await supabaseClient
          .from("profiles")
          .update(updates)
          .eq("user_id", userId);

        if (error) {
          logStep("Failed to update is_pro", { userId, isPro, message: error.message });
        } else {
          logStep("Synced is_pro", { userId, isPro, subscriptionEnd });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logStep("syncProStatus error (non-fatal)", { userId, message: msg });
      }
    };

    // ── Event handlers ──────────────────────────────────────────────────

    try {
      switch (event.type) {
        // ── Customer created ──────────────────────────────────────────
        case "customer.created": {
          const customer = event.data.object as Stripe.Customer;
          logStep("Processing customer.created", { customerId: customer.id, email: customer.email });

          if (customer.email) {
            const { data: userData } = await supabaseClient.auth.admin.getUserByEmail(customer.email);
            if (userData?.user) {
              await supabaseClient
                .from("profiles")
                .update({ stripe_customer_id: customer.id })
                .eq("user_id", userData.user.id);
              logStep("Stored stripe_customer_id on profile", { userId: userData.user.id, customerId: customer.id });
            } else {
              logStep("No auth user for this email — skipping link", { email: customer.email });
            }
          }
          logStep("processed customer.created successfully");
          break;
        }

        // ── Subscription created / updated ────────────────────────────
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          logStep(`Processing ${event.type}`, { customerId: subscription.customer, status: subscription.status, isActive });

          const userId = await resolveUser(subscription.customer as string);
          if (userId) {
            await syncProStatus(userId, isActive, subscription.current_period_end);
          } else {
            logStep("Could not resolve user — skipping sync", { customerId: subscription.customer });
          }
          logStep(`processed ${event.type} successfully`);
          break;
        }

        // ── Subscription deleted ──────────────────────────────────────
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep(`Processing ${event.type}`, { customerId: subscription.customer });

          const userId = await resolveUser(subscription.customer as string);
          if (userId) {
            await syncProStatus(userId, false, null);
          } else {
            logStep("Could not resolve user — skipping sync", { customerId: subscription.customer });
          }
          logStep("processed customer.subscription.deleted successfully");
          break;
        }

        // ── Invoice payment succeeded ─────────────────────────────────
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep(`Processing ${event.type}`, { customerId: invoice.customer, subscriptionId: invoice.subscription });

          if (invoice.customer && invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            const isActive = subscription.status === "active" || subscription.status === "trialing";
            const userId = await resolveUser(invoice.customer as string);
            if (userId) {
              await syncProStatus(userId, isActive, subscription.current_period_end);
            }
          } else {
            logStep("Payment succeeded (no subscription attached — skipping)");
          }
          logStep("processed invoice.payment_succeeded successfully");
          break;
        }

        // ── Invoice payment failed ────────────────────────────────────
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep(`Processing ${event.type}`, { customerId: invoice.customer, subscriptionId: invoice.subscription });

          if (invoice.customer) {
            const userId = await resolveUser(invoice.customer as string);
            if (userId) {
              await syncProStatus(userId, false, null);
              logStep("Revoked Pro status on payment failure", { userId });
            } else {
              logStep("Could not resolve user — skipping revoke", { customerId: invoice.customer });
            }
          }
          logStep("processed invoice.payment_failed successfully");
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
    const msg = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR", { message: msg });
    return new Response(JSON.stringify({ received: true, warning: "processing error logged" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
