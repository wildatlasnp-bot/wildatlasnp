import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
            Mochi is now scanning Recreation.gov every 2 minutes for your <strong style="color:#2D3B2D;">${d.permitName}</strong> permit at <strong style="color:#2D3B2D;">${d.parkName}</strong>. The moment a cancellation appears, you'll get a text at <strong style="color:#2D3B2D;">${d.maskedPhone}</strong> with a direct booking link.
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
              <a href="https://wildatlasnp.lovable.app/app" style="display:inline-block;background-color:#C4956A;color:#FFFFFF;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;font-family:-apple-system,sans-serif;">Open WildAtlas →</a>
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
                  <a href="https://wildatlasnp.lovable.app/app?tab=mochi&q=${encodeURIComponent(`Best time to visit ${d.parkName}`)}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">Best time to visit ${d.parkName}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:4px;">
                  <a href="https://wildatlasnp.lovable.app/app?tab=mochi&q=${encodeURIComponent('What should I pack?')}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">What should I pack?</a>
                </td>
              </tr>
              <tr>
                <td style="padding:4px;">
                  <a href="https://wildatlasnp.lovable.app/app?tab=mochi&q=${encodeURIComponent(`How hard is ${d.permitName} to get?`)}" style="display:inline-block;background-color:#F0EBE3;color:#2D3B2D;padding:10px 16px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;">How hard is ${d.permitName} to get?</a>
                </td>
              </tr>
            </table>
          </div>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:20px 28px 28px;border-top:1px solid #E8E0D5;">
          <div style="text-align:center;font-size:11px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
            WildAtlas · <a href="https://wildatlasnp.lovable.app" style="color:#A09888;">WildAtlas.com</a> · <a href="https://wildatlasnp.lovable.app/settings" style="color:#A09888;">Unsubscribe</a> · <a href="https://wildatlasnp.lovable.app/privacy" style="color:#A09888;">Privacy Policy</a> · <a href="https://wildatlasnp.lovable.app/terms" style="color:#A09888;">Terms of Service</a>
          </div>
          <div style="text-align:center;font-size:9px;color:#C0B8A8;line-height:1.6;margin-top:12px;font-family:-apple-system,sans-serif;">
            You are receiving this message because you signed up for WildAtlas permit alerts. By signing up, you consented to receive automated text messages about permit availability at the phone number you provided. Message frequency varies based on permit availability. Message &amp; data rates may apply. Reply STOP to any text to unsubscribe. Reply HELP for help. WildAtlas is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any government agency. Carrier terms may apply.
          </div>
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
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: accept service role OR user JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  // Allow service role OR authenticated user
  let isAuthorized = token === serviceRoleKey;
  if (!isAuthorized && token) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await userClient.auth.getUser(token);
    isAuthorized = !!data?.user;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const payload = await req.json();
    const { email, firstName, permitName, parkName, phone } = payload;

    if (!email) throw new Error("No email found in payload");

    const maskedPhone = phone ? maskPhone(phone) : "your phone";
    const displayFirstName = firstName || email.split("@")[0];

    const html = buildWelcomeHtml({
      email,
      firstName: displayFirstName,
      permitName: permitName || "your permit",
      parkName: parkName || "your park",
      maskedPhone,
    });

    console.log(`Sending personalized welcome email to ${email}`);

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
          "List-Unsubscribe": "<https://wildatlasnp.lovable.app/settings>",
        },
        tags: [{ name: "category", value: "welcome" }],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    await supabase.from("email_logs").insert({
      recipient_email: email,
      email_type: "welcome",
      status: "sent",
    });

    console.log(`Welcome email sent successfully to ${email}`);

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
