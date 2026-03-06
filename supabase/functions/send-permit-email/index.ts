import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function trackUrl(trackingBaseUrl: string, emailLogId: string, targetUrl: string, label: string): string {
  return `${trackingBaseUrl}?eid=${emailLogId}&t=click&r=${encodeURIComponent(targetUrl)}&l=${encodeURIComponent(label)}`;
}

const buildPermitAlertHtml = (
  permitName: string,
  parkName: string,
  availableDates: string[],
  trackingBaseUrl: string,
  emailLogId: string
) => {
  const dateList = availableDates.length
    ? availableDates
        .slice(0, 5)
        .map((d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))
        .join(", ")
    : "Check Recreation.gov for details";

  const recgovUrl = "https://www.recreation.gov";
  const appUrl = "https://wildatlasnp.lovable.app/app";

  const trackedRecgov = trackUrl(trackingBaseUrl, emailLogId, recgovUrl, "cta_claim_permit");
  const trackedUpgrade = trackUrl(trackingBaseUrl, emailLogId, appUrl, "cta_upgrade_pro");
  const trackedManage = trackUrl(trackingBaseUrl, emailLogId, appUrl, "footer_manage_watches");
  const pixelUrl = `${trackingBaseUrl}?eid=${emailLogId}&t=open`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2D3B2D; }
    .container { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 28px; }
    .icon { font-size: 40px; margin-bottom: 8px; }
    .title { font-size: 20px; font-weight: 700; color: #2D3B2D; margin: 0 0 4px; font-family: Georgia, serif; }
    .subtitle { font-size: 13px; color: #8B7D6B; margin: 0; }
    .alert-card { background: #FAF6F1; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid #E8E0D5; }
    .permit-name { font-size: 18px; font-weight: 700; color: #C4956A; margin: 0 0 6px; }
    .park-name { font-size: 13px; color: #6B5D4D; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .dates { font-size: 14px; color: #4A5D4A; line-height: 1.6; margin: 0; }
    .dates strong { color: #2D3B2D; }
    .cta-wrap { text-align: center; margin: 24px 0; }
    .cta { display: inline-block; background: #C4956A; color: #FFFFFF; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 700; }
    .upgrade { background: #F0EBE3; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .upgrade p { font-size: 12px; color: #6B5D4D; margin: 0 0 8px; }
    .upgrade a { color: #C4956A; font-weight: 700; text-decoration: underline; font-size: 12px; }
    .footer { text-align: center; font-size: 11px; color: #A09888; margin-top: 28px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🎯</div>
      <h1 class="title">Permit Found!</h1>
      <p class="subtitle">WildAtlas Permit Sniper</p>
    </div>
    <div class="alert-card">
      <p class="permit-name">${permitName}</p>
      <p class="park-name">${parkName}</p>
      <p class="dates"><strong>Available dates:</strong> ${dateList}</p>
    </div>
    <div class="cta-wrap">
      <a href="${trackedRecgov}" class="cta">Claim on Recreation.gov →</a>
    </div>
    <div class="upgrade">
      <p>⚡ Want instant SMS alerts? Upgrade to Pro for text notifications the second a permit drops.</p>
      <a href="${trackedUpgrade}">Upgrade to Pro →</a>
    </div>
    <div class="footer">
      <p>You're receiving this because you have an active watch on WildAtlas.<br/>
      <a href="${trackedManage}" style="color: #C4956A; text-decoration: underline;">Manage watches or unsubscribe</a><br/>
      WildAtlas — Tactical logistics for the modern ranger.</p>
    </div>
  </div>
  <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;" />
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: only accept calls from other edge functions via service role key
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== serviceRoleKey) {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey!);
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

  try {
    const { to, permitName, parkName, availableDates } = await req.json();

    if (!to || !permitName) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'permitName'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create email log entry for tracking
    const { data: emailLog } = await supabase.from("email_logs").insert({
      recipient_email: to,
      email_type: "permit_alert",
      status: "sending",
    }).select("id").single();

    const emailLogId = emailLog?.id || "unknown";

    console.log(`Sending permit alert email to ${to} for ${permitName}, logId: ${emailLogId}`);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WildAtlas 🎯 <mochi@alerts.wildatlas.app>",
        to: [to],
        subject: `🎯 Permit Found: ${permitName} just opened!`,
        html: buildPermitAlertHtml(
          permitName,
          parkName || "National Park",
          availableDates || [],
          trackingBaseUrl,
          emailLogId
        ),
        headers: {
          "List-Unsubscribe": "<https://wildatlasnp.lovable.app/app>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // Update log as failed
      await supabase.from("email_logs").update({
        status: "failed",
        error_message: `Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`,
      }).eq("id", emailLogId);
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    // Update log as sent
    await supabase.from("email_logs").update({ status: "sent" }).eq("id", emailLogId);

    console.log(`Permit alert email sent to ${to}, ID: ${resendData.id}`);
    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-permit-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
