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

function trackUrl(trackingBaseUrl: string, emailLogId: string, targetUrl: string, label: string): string {
  return `${trackingBaseUrl}?eid=${emailLogId}&t=click&r=${encodeURIComponent(targetUrl)}&l=${encodeURIComponent(label)}`;
}

interface DateSlot {
  date: string;
  spots: number | null; // null = unknown
}

/** Parse availableDates: supports "2026-03-10" or "2026-03-10:3" (date:spots) */
function parseDateSlots(availableDates: string[]): DateSlot[] {
  return availableDates.map((d) => {
    const [dateStr, spotsStr] = d.split(":");
    const spots = spotsStr ? parseInt(spotsStr, 10) : null;
    return { date: dateStr, spots: Number.isNaN(spots) ? null : spots };
  });
}

function isConsecutiveBatch(slots: DateSlot[]): boolean {
  if (slots.length < 3) return false;
  const sorted = slots
    .map((s) => new Date(s.date).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);
  if (sorted.length < 3) return false;
  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = (sorted[i] - sorted[i - 1]) / (86400000);
    if (diffDays <= 1) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 1;
    }
  }
  return false;
}

function scarcityBadge(spots: number | null): string {
  if (spots === null) {
    return `<span style="background:#E8F4E8;color:#4A5D4A;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:-apple-system,sans-serif;">Spots available</span>`;
  }
  if (spots === 1) {
    return `<span style="background:#FDE8E8;color:#B91C1C;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:-apple-system,sans-serif;">1 spot left</span>`;
  }
  if (spots <= 3) {
    return `<span style="background:#FFF3E0;color:#B8860B;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:-apple-system,sans-serif;">${spots} spots — limited</span>`;
  }
  return `<span style="background:#E8F4E8;color:#4A5D4A;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:-apple-system,sans-serif;">${spots} spots</span>`;
}

const buildPermitAlertHtml = (
  permitName: string,
  parkName: string,
  availableDates: string[],
  trackingBaseUrl: string,
  emailLogId: string,
  recgovPermitId?: string
) => {
  const slots = parseDateSlots(availableDates);
  const showBatch = isConsecutiveBatch(slots);

  // Build the booking URL — deep link when possible
  const bookingUrl = recgovPermitId
    ? `https://www.recreation.gov/permits/${recgovPermitId}`
    : "https://www.recreation.gov";
  const hasDeepLink = !!recgovPermitId;

  const visibleSlots = slots.slice(0, 5);
  const remainingCount = slots.length > 5 ? slots.length - 5 : 0;

  const formattedDates = visibleSlots.length
    ? visibleSlots
        .map((s) => {
          const date = new Date(s.date);
          return `<tr><td style="padding:8px 12px;font-size:14px;color:#2D3B2D;font-family:-apple-system,sans-serif;border-bottom:1px solid #E8E0D5;">
            <span style="font-weight:600;">${date.toLocaleDateString("en-US", { weekday: "short" })}</span>,
            ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #E8E0D5;">
            ${scarcityBadge(s.spots)}
          </td></tr>`;
        })
        .join("")
    : `<tr><td style="padding:12px;font-size:14px;color:#6B7B6B;font-family:-apple-system,sans-serif;">Check Recreation.gov for details</td></tr>`;

  const remainingNote = remainingCount > 0
    ? `<tr><td colspan="2" style="padding:10px 12px;font-size:12px;color:#6B5D4D;font-family:-apple-system,sans-serif;font-weight:600;">+ ${remainingCount} more date${remainingCount > 1 ? "s" : ""} available — open the app to view all</td></tr>`
    : "";

  const batchBanner = showBatch
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;border-left:3px solid #E8A84C;border-radius:6px;margin-bottom:12px;">
        <tr><td style="padding:10px 14px;font-size:12px;color:#8B7D6B;font-family:-apple-system,sans-serif;line-height:1.5;">
          <strong style="color:#B8860B;">Pattern detected:</strong> multiple dates opened together. These releases are often claimed quickly.
        </td></tr>
      </table>`
    : "";

  const appUrl = "https://wildatlasnp.lovable.app/app";

  const trackedRecgov = trackUrl(trackingBaseUrl, emailLogId, bookingUrl, "cta_claim_permit");
  const trackedUpgrade = trackUrl(trackingBaseUrl, emailLogId, appUrl, "cta_upgrade_pro");
  const trackedManage = trackUrl(trackingBaseUrl, emailLogId, appUrl, "footer_manage_watches");
  const trackedApp = trackUrl(trackingBaseUrl, emailLogId, appUrl, "cta_open_app");
  const pixelUrl = `${trackingBaseUrl}?eid=${emailLogId}&t=open`;

  const fallbackNote = !hasDeepLink
    ? `<div style="text-align:center;font-size:11px;color:#A09888;font-family:-apple-system,sans-serif;margin-bottom:28px;">Opening Recreation.gov — select the permit from the calendar.</div>`
    : `<div style="text-align:center;font-size:11px;color:#A09888;font-family:-apple-system,sans-serif;margin-bottom:28px;">Opens directly to the permit page on Recreation.gov</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Permit Found: ${permitName}!</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;color:#2D3B2D;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#FAF6F1;">🎉 ${permitName} at ${parkName} just opened up — claim it before it's gone!&#8199;&#65279;&#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6F1;">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- PERMIT FOUND HEADER -->
        <tr><td style="background:linear-gradient(135deg, #2D3B2D 0%, #4A5D4A 100%);border-radius:16px 16px 0 0;padding:36px 24px 28px;text-align:center;">
          <div style="font-size:48px;line-height:1;margin-bottom:12px;">🎉</div>
          <div style="font-size:24px;font-weight:700;color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;margin-bottom:4px;">Permit Found</div>
          <div style="font-size:13px;color:#C4956A;font-family:-apple-system,sans-serif;letter-spacing:0.5px;">WildAtlas just detected a permit opening</div>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background-color:#FFFFFF;padding:32px 28px 24px;">

          <!-- Permit Card: Name + Park -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;border:2px solid #C4956A;border-radius:14px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:20px;font-weight:700;color:#C4956A;font-family:Georgia,serif;margin-bottom:4px;">${permitName}</div>
              <div style="font-size:13px;color:#6B5D4D;text-transform:uppercase;letter-spacing:1px;font-weight:600;font-family:-apple-system,sans-serif;">${parkName}</div>
            </td></tr>
          </table>

          <!-- Available Dates -->
          <div style="font-size:11px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-family:-apple-system,sans-serif;">Available Dates</div>
          ${batchBanner}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E0D5;border-radius:10px;margin-bottom:24px;">
            ${formattedDates}
            ${remainingNote}
          </table>

          <!-- Primary CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:0 0 8px;">
              <a href="${trackedRecgov}" style="display:block;background:#C4956A;color:#FFFFFF;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;font-family:-apple-system,sans-serif;text-align:center;">Claim on Recreation.gov →</a>
            </td></tr>
          </table>
          ${fallbackNote}

          <!-- Urgency Banner -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;border-left:4px solid #E8A84C;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:14px;font-weight:700;color:#B8860B;font-family:-apple-system,sans-serif;margin-bottom:2px;">⏰ Act Fast</div>
              <div style="font-size:12px;color:#8B7D6B;font-family:-apple-system,sans-serif;line-height:1.5;">Cancellation permits typically get claimed within minutes.</div>
            </td></tr>
          </table>

          <!-- DIVIDER -->
          <div style="border-top:1px solid #E8E0D5;margin:0 0 24px;"></div>

          <!-- Pro Upgrade — visually secondary, at the bottom -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EBE3;border-radius:10px;">
            <tr><td style="padding:16px 20px;text-align:center;">
              <div style="font-size:12px;color:#6B5D4D;margin-bottom:8px;font-family:-apple-system,sans-serif;line-height:1.5;">Want faster scans and multi-park tracking?</div>
              <a href="${trackedUpgrade}" style="color:#C4956A;font-weight:700;text-decoration:underline;font-size:12px;font-family:-apple-system,sans-serif;">Upgrade to Pro →</a>
            </td></tr>
          </table>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:20px 28px 28px;border-top:1px solid #E8E0D5;">
          <div style="text-align:center;font-size:11px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
            WildAtlas · <a href="${trackedApp}" style="color:#A09888;">Open App</a> · <a href="${trackedManage}" style="color:#A09888;">Manage Watches</a> · <a href="${trackUrl(trackingBaseUrl, emailLogId, "https://wildatlasnp.lovable.app/privacy", "footer_privacy")}" style="color:#A09888;">Privacy</a> · <a href="${trackUrl(trackingBaseUrl, emailLogId, "https://wildatlasnp.lovable.app/terms", "footer_terms")}" style="color:#A09888;">Terms</a>
          </div>
          <div style="text-align:center;font-size:9px;color:#C0B8A8;line-height:1.6;margin-top:12px;font-family:-apple-system,sans-serif;">
            You're receiving this because you have an active watch on WildAtlas.<br/>
            WildAtlas — Tactical logistics for the modern ranger.
          </div>
        </td></tr>

        <!-- TRACKING PIXEL -->
        <tr><td style="height:1px;overflow:hidden;line-height:1px;">
          <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
        </td></tr>

        <tr><td style="height:32px;"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// Preview endpoint
async function handlePreview(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const sampleDates = [
    "2026-07-15:3", "2026-07-16:1", "2026-07-17:5", "2026-08-01", "2026-08-05:2", "2026-08-12"
  ];

  const html = buildPermitAlertHtml(
    "Half Dome Day Hike",
    "Yosemite National Park",
    sampleDates,
    "https://example.com/track",
    "preview-test",
    "233396"
  );

  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders(req), "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Preview route — no auth needed
  if (url.pathname.endsWith("/preview")) {
    return handlePreview(req);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  // Check if this is a test email request from an authenticated user
  const body = await req.json().catch(() => ({}));

  if ((body as Record<string, unknown>).test === true) {
    // Validate user JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

    const { data: emailLog } = await adminClient.from("email_logs").insert({
      recipient_email: user.email,
      email_type: "test_alert",
      status: "sending",
    }).select("id").single();

    const emailLogId = emailLog?.id || "unknown";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WildAtlas 🎯 <mochi@alerts.wildatlas.app>",
        to: [user.email],
        subject: "🧪 Test Alert — WildAtlas Notifications Working!",
        html: buildPermitAlertHtml(
          "Half Dome Day Hike",
          "Yosemite National Park",
          ["2026-07-15:3", "2026-07-16:1", "2026-07-17:5"],
          trackingBaseUrl,
          emailLogId,
          "233396"
        ),
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      await adminClient.from("email_logs").update({
        status: "failed",
        error_message: `Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`,
      }).eq("id", emailLogId);
      throw new Error(`Resend error: ${JSON.stringify(resendData)}`);
    }

    await adminClient.from("email_logs").update({ status: "sent" }).eq("id", emailLogId);
    console.log(`Test alert sent to ${user.email}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Production auth guard: only service role key
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

  try {
    const { to, permitName, parkName, availableDates, recgovPermitId } = body as Record<string, unknown>;

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
        subject: `🎉 Permit Found: ${permitName} just opened!`,
        html: buildPermitAlertHtml(
          permitName,
          parkName || "National Park",
          availableDates || [],
          trackingBaseUrl,
          emailLogId,
          recgovPermitId
        ),
        headers: {
          "List-Unsubscribe": "<https://wildatlasnp.lovable.app/app>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      await supabase.from("email_logs").update({
        status: "failed",
        error_message: `Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`,
      }).eq("id", emailLogId);
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

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
