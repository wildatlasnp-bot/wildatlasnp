import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: unknown) => {
  const d = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${d}`);
};

const GRACE_PERIOD_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // ── 1. Verify identity ──
    // Auth: prefer Authorization header, fall back to body._authToken (handles platform header stripping)
    const headerAuth = req.headers.get("Authorization");
    let bodyToken: string | null = null;
    try {
      const body = await req.json();
      bodyToken = typeof body._authToken === "string" ? body._authToken : null;
    } catch { /* no body or non-JSON — fine */ }

    const effectiveAuth = headerAuth || (bodyToken ? `Bearer ${bodyToken}` : null);
    if (!effectiveAuth) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = effectiveAuth.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: effectiveAuth } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      log("Auth failed", { error: userError?.message, tokenPrefix: token.substring(0, 20) });
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    log("Identity verified", { userId: user.id, email: user.email });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── 2. Cancel Stripe subscriptions if active ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let subscriptionCancelled = false;

    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

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
          for (const status of ["active", "trialing"] as const) {
            const subs = await stripe.subscriptions.list({ customer: customerId, status });
            for (const sub of subs.data) {
              await stripe.subscriptions.cancel(sub.id);
              log(`Stripe ${status} subscription cancelled`, { subscriptionId: sub.id });
              subscriptionCancelled = true;
            }
          }
          if (!subscriptionCancelled) {
            log("No active Stripe subscriptions found");
          }
        } else {
          log("No Stripe customer found — skipping billing cleanup");
        }
      } catch (stripeErr) {
        log("Stripe cancellation error (non-blocking)", {
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
      }
    }

    // ── 3. Deactivate watches and set soft-delete timestamp ──
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + GRACE_PERIOD_DAYS);

    // Deactivate all watches so scanner stops checking
    await adminClient
      .from("active_watches")
      .update({ is_active: false })
      .eq("user_id", user.id);

    await adminClient
      .from("user_watchers")
      .update({ is_active: false })
      .eq("user_id", user.id);

    // Mark profile for deletion
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        scheduled_deletion_at: deletionDate.toISOString(),
        is_pro: false,
      })
      .eq("user_id", user.id);

    if (updateError) {
      log("Failed to set scheduled_deletion_at", { error: updateError.message });
      return new Response(JSON.stringify({ error: "Failed to schedule account deletion" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    log("Account scheduled for deletion", { deletionDate: deletionDate.toISOString() });

    // ── 4. Write audit log ──
    await adminClient.from("account_deletion_audit").insert({
      user_id: user.id,
      user_email: user.email ?? "unknown",
      subscription_cancelled: subscriptionCancelled,
      deletion_type: "scheduled",
      scheduled_deletion_at: deletionDate.toISOString(),
    });

    // ── 5. Send notification email ──
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && user.email) {
      try {
        const formattedDate = deletionDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "WildAtlas <mochi@alerts.wildatlas.app>",
            to: [user.email],
            subject: "Your WildAtlas account is scheduled for deletion",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 16px;">Account Deletion Scheduled</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                  Your WildAtlas account has been scheduled for permanent deletion on <strong>${formattedDate}</strong>.
                </p>
                ${subscriptionCancelled ? '<p style="color: #555; font-size: 14px; line-height: 1.6;">Your Pro subscription has been cancelled and you will not be charged again.</p>' : ""}
                <p style="color: #555; font-size: 14px; line-height: 1.6; margin-top: 16px;">
                  <strong>Changed your mind?</strong> Simply log back in before ${formattedDate} and your account will be fully restored — watches, settings, everything.
                </p>
                <p style="color: #555; font-size: 14px; line-height: 1.6; margin-top: 16px;">
                  If you didn't request this, please log in immediately or contact us at
                  <a href="mailto:wildatlasnp@gmail.com" style="color: #E07050;">wildatlasnp@gmail.com</a>.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">— The WildAtlas Team 🐻</p>
              </div>
            `,
          }),
        });
        log("Deletion scheduled email sent", { email: user.email });
      } catch (emailErr) {
        log("Deletion email failed (non-blocking)", {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      subscription_cancelled: subscriptionCancelled,
      deletion_date: deletionDate.toISOString(),
      grace_period_days: GRACE_PERIOD_DAYS,
    }), {
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
