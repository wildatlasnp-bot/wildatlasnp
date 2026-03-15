import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "your phone";
  return `(***) ***-${phone.slice(-4)}`;
}

interface WelcomeData {
  email: string;
  firstName: string;
  permitName: string;
  parkName: string;
  maskedPhone: string;
  trackingBaseUrl: string;
  emailLogId: string;
  appBaseUrl: string;
}

function trackUrl(d: WelcomeData, targetUrl: string, label: string): string {
  return `${d.trackingBaseUrl}?eid=${d.emailLogId}&t=click&r=${encodeURIComponent(targetUrl)}&l=${encodeURIComponent(label)}`;
}

const buildWelcomeHtml = (d: WelcomeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>You're live, ${d.firstName} — Mochi is watching</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
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

          <!-- Opening -->
          <h1 style="font-size:22px;font-weight:700;color:#2D3B2D;margin:0 0 16px;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
            You're all set, ${d.firstName}.
          </h1>
          <p style="font-size:14px;line-height:1.7;color:#6B7B6B;margin:0 0 24px;font-family:-apple-system,sans-serif;">
            Mochi is now watching Recreation.gov throughout the day for your <strong style="color:#2D3B2D;">${d.permitName}</strong> permit at <strong style="color:#2D3B2D;">${d.parkName}</strong>. The moment a cancellation appears, you'll get a text at <strong style="color:#2D3B2D;">${d.maskedPhone}</strong> with a direct booking link.
          </p>

          <!-- DIVIDER -->
          <div style="border-top:1px solid #E8E0D5;margin:0 0 24px;"></div>

          <!-- 3-STEP SECTION -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td width="33%" align="center" valign="top" style="padding:0 8px;">
                <div style="width:44px;height:44px;border-radius:12px;background-color:#FFF0E8;margin:0 auto 10px;line-height:44px;text-align:center;font-size:20px;">⚡</div>
                <div style="font-size:11px;font-weight:700;color:#2D3B2D;font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Step 1</div>
                <div style="font-size:12px;color:#6B7B6B;margin-top:4px;font-family:-apple-system,sans-serif;">Permit opens</div>
              </td>
              <td width="33%" align="center" valign="top" style="padding:0 8px;">
                <div style="width:44px;height:44px;border-radius:12px;background-color:#E8F4E8;margin:0 auto 10px;line-height:44px;text-align:center;font-size:20px;">📱</div>
                <div style="font-size:11px;font-weight:700;color:#2D3B2D;font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Step 2</div>
                <div style="font-size:12px;color:#6B7B6B;margin-top:4px;font-family:-apple-system,sans-serif;">You get a text instantly</div>
              </td>
              <td width="33%" align="center" valign="top" style="padding:0 8px;">
                <div style="width:44px;height:44px;border-radius:12px;background-color:#E8EFF8;margin:0 auto 10px;line-height:44px;text-align:center;font-size:20px;">✅</div>
                <div style="font-size:11px;font-weight:700;color:#2D3B2D;font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Step 3</div>
                <div style="font-size:12px;color:#6B7B6B;margin-top:4px;font-family:-apple-system,sans-serif;">Tap the link and book</div>
              </td>
            </tr>
          </table>

          <!-- MOCK SMS SECTION -->
          <div style="margin-bottom:28px;">
            <div style="font-size:11px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-family:-apple-system,sans-serif;">What your alert will look like</div>
            <div style="background-color:#E8F4E8;border-radius:16px;padding:20px;border:1px solid #D0E8D0;">
              <div style="font-size:10px;color:#6B7B6B;margin-bottom:8px;font-family:-apple-system,sans-serif;">SMS from WildAtlas</div>
              <div style="font-size:13px;color:#2D3B2D;line-height:1.6;font-family:-apple-system,sans-serif;">
                🐻 <strong>${d.permitName}</strong> just opened at ${d.parkName}!<br/>
                Dates: Jul 15–16<br/>
                Book now before it's gone:<br/>
                <span style="color:#C4956A;text-decoration:underline;">recreation.gov/permits/...</span>
              </div>
            </div>
          </div>

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:0 0 28px;">
              <a href="${trackUrl(d, d.appBaseUrl + '/app', 'cta_open_app')}" style="display:inline-block;background-color:#C4956A;color:#FFFFFF;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;font-family:-apple-system,sans-serif;">Open WildAtlas →</a>
            </td></tr>
          </table>

          <!-- DIVIDER -->
          <div style="border-top:1px solid #E8E0D5;margin:0 0 24px;"></div>

          <!-- MOCHI QUICK-START -->
          <div style="text-align:center;margin-bottom:8px;">
            <div style="font-size:11px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;font-family:-apple-system,sans-serif;">Ask Mochi anything</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding:4px;">
                  <a href="${trackUrl(d, `${d.appBaseUrl}/app?tab=mochi&q=${encodeURIComponent(`Best time to visit ${d.parkName}`)}`, 'chip_best_time')}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">Best time to visit ${d.parkName}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:4px;">
                  <a href="${trackUrl(d, `${d.appBaseUrl}/app?tab=mochi&q=${encodeURIComponent('What should I pack?')}`, 'chip_pack')}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">What should I pack?</a>
                </td>
              </tr>
              <tr>
                <td style="padding:4px;">
                  <a href="${trackUrl(d, `${d.appBaseUrl}/app?tab=mochi&q=${encodeURIComponent(`How hard is ${d.permitName} to get?`)}`, 'chip_difficulty')}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">How hard is ${d.permitName} to get?</a>
                </td>
              </tr>
            </table>
          </div>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:20px 28px 28px;border-top:1px solid #E8E0D5;">
          <div style="text-align:center;font-size:11px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
            WildAtlas · <a href="${trackUrl(d, d.appBaseUrl, 'footer_home')}" style="color:#A09888;">WildAtlas.com</a> · <a href="${trackUrl(d, d.appBaseUrl + '/settings', 'footer_unsubscribe')}" style="color:#A09888;">Unsubscribe</a> · <a href="${trackUrl(d, d.appBaseUrl + '/privacy', 'footer_privacy')}" style="color:#A09888;">Privacy Policy</a> · <a href="${trackUrl(d, d.appBaseUrl + '/terms', 'footer_terms')}" style="color:#A09888;">Terms of Service</a>
          </div>
          <div style="text-align:center;font-size:9px;color:#C0B8A8;line-height:1.6;margin-top:12px;font-family:-apple-system,sans-serif;">
            You are receiving this message because you signed up for WildAtlas permit alerts. By signing up, you consented to receive automated text messages about permit availability at the phone number you provided. Message frequency varies based on permit availability. Message &amp; data rates may apply. Reply STOP to any text to unsubscribe. Reply HELP for help. WildAtlas is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any government agency. Carrier terms may apply.
          </div>
        </td></tr>

        <!-- TRACKING PIXEL -->
        <tr><td style="height:1px;overflow:hidden;line-height:1px;">
          <img src="${d.trackingBaseUrl}?eid=${d.emailLogId}&t=open" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
        </td></tr>

        <!-- SPACER -->
        <tr><td style="height:32px;"></td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth: accept service role OR user JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  let isAuthorized = token === serviceRoleKey;
  if (!isAuthorized && token) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await userClient.auth.getUser();
    isAuthorized = !!data?.user;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const appBaseUrl = Deno.env.get("APP_URL") ?? "https://wildatlas.app";

  try {
    const payload = await req.json();
    const { email, firstName, permitName, parkName, phone } = payload;

    if (!email) throw new Error("No email found in payload");

    const maskedPhone = phone ? maskPhone(phone) : "your phone";
    const displayFirstName = firstName || email.split("@")[0];

    // Insert email log first to get the ID for tracking
    const { data: logData, error: logError } = await supabase
      .from("email_logs")
      .insert({
        recipient_email: email,
        email_type: "welcome",
        status: "sending",
      })
      .select("id")
      .single();

    if (logError || !logData) {
      throw new Error(`Failed to create email log: ${logError?.message}`);
    }

    const emailLogId = logData.id;
    const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

    const html = buildWelcomeHtml({
      email,
      firstName: displayFirstName,
      permitName: permitName || "your permit",
      parkName: parkName || "your park",
      maskedPhone,
      trackingBaseUrl,
      emailLogId,
      appBaseUrl,
    });

    console.log(`Sending personalized welcome email (logId: ${emailLogId})`);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mochi 🐻 <mochi@alerts.wildatlas.app>",
        to: [email],
        subject: `You're live, ${displayFirstName} — Mochi is watching 🐻`,
        html,
        headers: {
          "X-Entity-Ref-ID": `welcome-${Date.now()}`,
          "List-Unsubscribe": `<${appBaseUrl}/settings>`,
        },
        tags: [{ name: "category", value: "welcome" }],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // Update log to failed
      await supabase.from("email_logs").update({ status: "failed", error_message: JSON.stringify(resendData) }).eq("id", emailLogId);
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    // Update log to sent
    await supabase.from("email_logs").update({ status: "sent" }).eq("id", emailLogId);

    console.log(`Welcome email sent successfully (logId: ${emailLogId})`);

    return new Response(JSON.stringify({ success: true, id: resendData.id, emailLogId }), {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Email send error:", errorMessage);

    try {
      await supabase.from("email_logs").insert({
        recipient_email: "unknown",
        email_type: "welcome",
        status: "failed",
        error_message: errorMessage,
      });
    } catch (logErr) {
      console.error("Failed to log email error:", logErr);
    }

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
