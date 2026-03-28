import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildProConfirmHtml(toEmail: string, amountDisplay: string, appBaseUrl: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>You're now on WildAtlas Pro</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;color:#2D3B2D;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6F1;">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background-color:#2D3B2D;border-radius:16px 16px 0 0;padding:32px 24px 24px;text-align:center;">
          <div style="font-size:36px;line-height:1;margin-bottom:8px;">🏔️</div>
          <div style="font-size:20px;font-weight:700;color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;">WildAtlas</div>
          <div style="font-size:11px;color:#A09888;margin-top:4px;font-family:-apple-system,sans-serif;">Tactical logistics for the modern ranger</div>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background-color:#FFFFFF;padding:32px 28px;">
          <h1 style="font-size:22px;font-weight:700;color:#2D3B2D;margin:0 0 8px;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
            You're now on WildAtlas Pro.
          </h1>
          <p style="font-size:14px;line-height:1.7;color:#6B7B6B;margin:0 0 24px;font-family:-apple-system,sans-serif;">
            Your Pro membership is active. Mochi is scanning faster, your alert limit is lifted, and SMS alerts are on.
          </p>

          <!-- BILLING SUMMARY -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-family:-apple-system,sans-serif;">Billing summary</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6B7B6B;font-family:-apple-system,sans-serif;">Plan</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#2D3B2D;font-family:-apple-system,sans-serif;">WildAtlas Pro</td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="font-size:13px;color:#6B7B6B;font-family:-apple-system,sans-serif;">Amount charged</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#2D3B2D;font-family:-apple-system,sans-serif;">${escapeHtml(amountDisplay)}</td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="font-size:13px;color:#6B7B6B;font-family:-apple-system,sans-serif;">Billing period</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#2D3B2D;font-family:-apple-system,sans-serif;">Monthly</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${escapeHtml(appBaseUrl)}/app" style="display:inline-block;background-color:#C4956A;color:#FFFFFF;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;font-family:-apple-system,sans-serif;">Open WildAtlas →</a>
            </td></tr>
          </table>

          <div style="border-top:1px solid #E8E0D5;margin:0 0 20px;"></div>

          <p style="font-size:13px;line-height:1.7;color:#6B7B6B;margin:0;font-family:-apple-system,sans-serif;">
            To cancel your subscription at any time, visit your <a href="${escapeHtml(appBaseUrl)}/settings" style="color:#2F6F4E;">Settings page</a>.<br/>
            Questions? Reply to this email or visit <a href="${escapeHtml(appBaseUrl)}" style="color:#2F6F4E;">wildatlas.app</a>.
          </p>

        </td></tr>

        <!-- FOOTER -->
        <!-- TODO: Replace [P.O. BOX ADDRESS] with actual mailing address before launch -->
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:20px 28px 28px;border-top:1px solid #E8E0D5;">
          <div style="text-align:center;font-size:11px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
            WildAtlas &middot; [P.O. BOX ADDRESS] &middot; Los Angeles, CA &middot; United States<br>
            <a href="${escapeHtml(unsubUrl)}" style="color:#A09888;">Unsubscribe</a>
            &nbsp;&middot;&nbsp;
            <a href="${escapeHtml(appBaseUrl)}/settings" style="color:#A09888;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${escapeHtml(appBaseUrl)}/privacy" style="color:#A09888;">Privacy Policy</a>
          </div>
        </td></tr>

        <!-- SPACER -->
        <tr><td style="height:32px;"></td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    logStep("ERROR", { message: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Idempotency: reject duplicate Stripe event deliveries
    const { error: dupError } = await supabaseClient
      .from("processed_stripe_events")
      .insert({ event_id: event.id });
    if (dupError?.code === "23505") {
      logStep("Duplicate event ignored", { id: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

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

        // 2) Fallback: fetch email from Stripe, then look up profile by email
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !("email" in customer) || !customer.email) {
          logStep("Customer not found or deleted", { customerId });
          return null;
        }

        const { data: byEmail } = await supabaseClient
          .from("profiles")
          .select("user_id")
          .eq("email", customer.email)
          .maybeSingle();

        if (!byEmail?.user_id) {
          logStep("No profile found for email", { customerId });
          return null;
        }

        // Link stripe_customer_id for future lookups
        await supabaseClient
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", byEmail.user_id);

        logStep("Linked stripe_customer_id to user", { userId: byEmail.user_id, customerId });
        return byEmail.user_id as string;
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
          logStep("Processing customer.created", { customerId: customer.id });

          if (customer.email) {
            const { data: byEmail } = await supabaseClient
              .from("profiles")
              .select("user_id")
              .eq("email", customer.email)
              .maybeSingle();
            if (byEmail?.user_id) {
              await supabaseClient
                .from("profiles")
                .update({ stripe_customer_id: customer.id })
                .eq("user_id", byEmail.user_id);
              logStep("Stored stripe_customer_id on profile", { userId: byEmail.user_id, customerId: customer.id });
            } else {
              logStep("No profile found for this email — skipping link", { customerId: customer.id });
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

        // ── Subscription paused ───────────────────────────────────────
        case "customer.subscription.paused": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep(`Processing ${event.type}`, { customerId: subscription.customer });

          const resumesAt = (subscription.pause_collection as { resumes_at?: number | null } | null)?.resumes_at ?? null;
          const userId = await resolveUser(subscription.customer as string);
          if (userId) {
            await syncProStatus(userId, false, resumesAt);
            logStep("Revoked Pro status on subscription pause", { userId, resumesAt });
          } else {
            logStep("Could not resolve user — skipping sync", { customerId: subscription.customer });
          }
          logStep("processed customer.subscription.paused successfully");
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

              // Send Pro confirmation email — non-blocking, does not affect webhook response
              if (invoice.amount_paid > 0) {
                const resendKey = Deno.env.get("RESEND_API_KEY");
                const toEmail = invoice.customer_email ?? null;
                if (resendKey && toEmail) {
                  const appBaseUrl = Deno.env.get("APP_URL") ?? "https://wildatlas.app";
                  const amountDisplay = `$${(invoice.amount_paid / 100).toFixed(2)}`;
                  const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
                  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
                  const proUnsubUrl = userId && unsubscribeSecret
                    ? `${supabaseUrl}/functions/v1/unsubscribe?uid=${userId}&token=${await generateUnsubscribeToken(userId, unsubscribeSecret)}`
                    : `${appBaseUrl}/settings`;
                  const html = buildProConfirmHtml(toEmail, amountDisplay, appBaseUrl, proUnsubUrl);
                  (async () => {
                    try {
                      const { data: logData } = await supabaseClient
                        .from("email_logs")
                        .insert({ recipient_email: toEmail, email_type: "pro_confirmation", status: "sending" })
                        .select("id")
                        .single();
                      const emailLogId = logData?.id ?? null;
                      const res = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                          from: "WildAtlas <mochi@alerts.wildatlas.app>",
                          to: [toEmail],
                          subject: "You're now on WildAtlas Pro",
                          html,
                          headers: {
                            "List-Unsubscribe": `<${proUnsubUrl}>`,
                            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                          },
                          tags: [{ name: "category", value: "pro_confirmation" }],
                        }),
                      });
                      logStep("Pro confirmation email " + (res.ok ? "sent" : `failed [${res.status}]`), { userId });
                      if (emailLogId) {
                        await supabaseClient.from("email_logs")
                          .update({ status: res.ok ? "sent" : "failed" })
                          .eq("id", emailLogId);
                      }
                    } catch (err: unknown) {
                      logStep("Pro confirmation email error (non-fatal)", { message: err instanceof Error ? err.message : String(err) });
                    }
                  })();
                } else {
                  logStep("Pro confirmation email skipped", { reason: !resendKey ? "RESEND_API_KEY not set" : "no customer_email on invoice" });
                }
              }
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

          // Only revoke Pro for subscription-related invoice failures, not one-time charges.
          if (invoice.customer && invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription as string
            );
            if (subscription.status === "active" || subscription.status === "trialing") {
              logStep("Skipping Pro revoke — subscription still active during payment retry", {
                status: subscription.status,
              });
              break;
            }
            const userId = await resolveUser(invoice.customer as string);
            if (userId) {
              await syncProStatus(userId, false, null);
              logStep("Revoked Pro status on payment failure", { userId });
            } else {
              logStep("Could not resolve user — skipping revoke", { customerId: invoice.customer });
            }
          } else if (invoice.customer && !invoice.subscription) {
            logStep("Payment failed on non-subscription invoice — skipping Pro revoke", { customerId: invoice.customer });
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
      return new Response(JSON.stringify({ error: "Handler failed" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: "Handler failed" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
