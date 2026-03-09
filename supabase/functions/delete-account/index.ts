import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

const log = (step: string, details?: unknown) => {
  const d = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // ── 1. Verify identity ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    log("Identity verified", { userId: user.id, email: user.email });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── 2. Cancel Stripe subscription if active ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let subscriptionCancelled = false;

    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        // Look up Stripe customer by stored ID or email
        const { data: profile } = await adminClient
          .from("profiles")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        let customerId: string | null = profile?.stripe_customer_id ?? null;

        if (!customerId && user.email) {
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
          }
        }

        if (customerId) {
          // Cancel ALL active subscriptions for this customer
          const subs = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
          });

          for (const sub of subs.data) {
            await stripe.subscriptions.cancel(sub.id);
            log("Stripe subscription cancelled", { subscriptionId: sub.id });
            subscriptionCancelled = true;
          }

          // Also cancel trialing subscriptions
          const trialSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: "trialing",
          });

          for (const sub of trialSubs.data) {
            await stripe.subscriptions.cancel(sub.id);
            log("Stripe trial subscription cancelled", { subscriptionId: sub.id });
            subscriptionCancelled = true;
          }

          if (!subscriptionCancelled) {
            log("No active Stripe subscriptions found");
          }
        } else {
          log("No Stripe customer found — skipping billing cleanup");
        }
      } catch (stripeErr) {
        // Stripe failure should NOT block deletion — log and continue
        log("Stripe cancellation error (non-blocking)", {
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
      }
    } else {
      log("STRIPE_SECRET_KEY not set — skipping billing cleanup");
    }

    // ── 3. Delete app data (order matters: dependent rows first) ──
    await adminClient.from("notification_queue").delete().eq("user_id", user.id);
    await adminClient.from("notification_log").delete().eq("user_id", user.id);
    await adminClient.from("crowd_report_events").delete().eq("user_id", user.id);
    await adminClient.from("phone_verifications").delete().eq("user_id", user.id);
    await adminClient.from("pro_nudge_emails").delete().eq("user_id", user.id);
    await adminClient.from("user_watchers").delete().eq("user_id", user.id);
    await adminClient.from("active_watches").delete().eq("user_id", user.id);
    await adminClient.from("pro_waitlist").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("user_id", user.id);
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    log("App data deleted");

    // ── 4. Delete auth user ──
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    log("Auth user deleted");

    // ── 5. Send confirmation email ──
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && user.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "WildAtlas <mochi@alerts.wildatlas.app>",
            to: [user.email],
            subject: "Your WildAtlas account has been deleted",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 16px;">Account Deleted</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                  Your WildAtlas account and all associated data have been permanently deleted.
                  ${subscriptionCancelled ? "Your Pro subscription has been cancelled and you will not be charged again." : ""}
                </p>
                <p style="color: #555; font-size: 14px; line-height: 1.6; margin-top: 16px;">
                  If you didn't request this, please contact us immediately at
                  <a href="mailto:wildatlasnp@gmail.com" style="color: #E07050;">wildatlasnp@gmail.com</a>.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">— The WildAtlas Team 🐻</p>
              </div>
            `,
          }),
        });
        log("Confirmation email sent", { email: user.email });
      } catch (emailErr) {
        // Email failure should not surface as an error to the user
        log("Confirmation email failed (non-blocking)", {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    }

    log(`🗑️ Account fully deleted: ${user.id}`);
    return new Response(JSON.stringify({ success: true, subscription_cancelled: subscriptionCancelled }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-account error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
