import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NudgeData {
  firstName: string;
  permitName: string;
  parkName: string;
  parkId: string;
  trackingBaseUrl: string;
  emailLogId: string;
}

const PARK_DISPLAY: Record<string, { name: string; emoji: string }> = {
  yosemite: { name: "Yosemite", emoji: "🏔️" },
  rainier: { name: "Rainier", emoji: "⛰️" },
  zion: { name: "Zion", emoji: "🏜️" },
  glacier: { name: "Glacier", emoji: "❄️" },
  rocky_mountain: { name: "Rocky Mountain", emoji: "🦌" },
  arches: { name: "Arches", emoji: "🌅" },
};

function trackUrl(d: NudgeData, targetUrl: string, label: string): string {
  return `${d.trackingBaseUrl}?eid=${d.emailLogId}&t=click&r=${encodeURIComponent(targetUrl)}&l=${encodeURIComponent(label)}`;
}

function buildParkGrid(d: NudgeData): string {
  const parkIds = Object.keys(PARK_DISPLAY);
  let rows = "";

  for (let i = 0; i < parkIds.length; i += 3) {
    const chunk = parkIds.slice(i, i + 3);
    const cells = chunk
      .map((pid) => {
        const p = PARK_DISPLAY[pid];
        const isCurrentPark = pid === d.parkId;
        const bg = isCurrentPark ? "#E8F4E8" : "#FAF6F1";
        const border = isCurrentPark ? "2px solid #4A5D4A" : "1px solid #E8E0D5";
        const label = isCurrentPark
          ? `<div style="font-size:11px;font-weight:700;color:#4A5D4A;margin-top:2px;">✓ Tracking</div>`
          : `<a href="${trackUrl(d, "https://wildatlasnp.lovable.app/app?tab=alerts", `grid_add_${pid}`)}" style="font-size:11px;font-weight:700;color:#C4956A;text-decoration:none;margin-top:2px;display:block;">Add →</a>`;
        return `<td width="33%" align="center" valign="top" style="padding:6px;">
          <div style="background:${bg};border:${border};border-radius:12px;padding:16px 8px;text-align:center;">
            <div style="font-size:24px;line-height:1;">${p.emoji}</div>
            <div style="font-size:12px;font-weight:700;color:#2D3B2D;margin-top:6px;font-family:-apple-system,sans-serif;">${p.name}</div>
            ${label}
          </div>
        </td>`;
      })
      .join("");
    rows += `<tr>${cells}</tr>`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${rows}</table>`;
}

const buildNudgeHtml = (d: NudgeData) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>You're only tracking 1 permit, ${d.firstName}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;color:#2D3B2D;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#FAF6F1;">Pro includes unlimited permit trackers. Here's how to add more.&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6F1;">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background-color:#2D3B2D;border-radius:16px 16px 0 0;padding:32px 24px 24px;text-align:center;">
          <div style="font-size:36px;line-height:1;margin-bottom:8px;">🐻</div>
          <div style="font-size:20px;font-weight:700;color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;">WildAtlas Pro</div>
          <div style="font-size:11px;color:#C4956A;margin-top:4px;font-family:-apple-system,sans-serif;">Unlimited Permit Tracking</div>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background-color:#FFFFFF;padding:32px 28px;">

          <!-- Opening -->
          <p style="font-size:15px;line-height:1.7;color:#2D3B2D;margin:0 0 20px;font-family:-apple-system,sans-serif;">
            Hey ${d.firstName} — just checking in.
          </p>

          <p style="font-size:14px;line-height:1.7;color:#6B7B6B;margin:0 0 24px;font-family:-apple-system,sans-serif;">
            You upgraded to Pro which means you can track <strong style="color:#2D3B2D;">unlimited permits</strong> across all six parks. But right now you're only watching <strong style="color:#2D3B2D;">${d.permitName}</strong> at <strong style="color:#2D3B2D;">${d.parkName}</strong>. Want to add more?
          </p>

          <!-- DIVIDER -->
          <div style="border-top:1px solid #E8E0D5;margin:0 0 24px;"></div>

          <!-- PARK GRID -->
          <div style="font-size:11px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;font-family:-apple-system,sans-serif;">Your parks</div>
          ${buildParkGrid(d)}

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:0 0 16px;">
              <a href="${trackUrl(d, "https://wildatlasnp.lovable.app/app?tab=alerts", "cta_add_permit")}" style="display:block;background-color:#C4956A;color:#FFFFFF;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;font-family:-apple-system,sans-serif;text-align:center;">Add Another Permit →</a>
            </td></tr>
          </table>

          <p style="font-size:12px;color:#A09888;text-align:center;margin:0 0 24px;font-family:-apple-system,sans-serif;line-height:1.6;">
            You can add as many permits as you want — Half Dome, Wilderness, Wonderland Trail, Camp Muir, Angels Landing and more.
          </p>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:20px 28px 28px;border-top:1px solid #E8E0D5;">
          <div style="text-align:center;font-size:11px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
            WildAtlas · <a href="${trackUrl(d, "https://wildatlasnp.lovable.app", "footer_home")}" style="color:#A09888;">WildAtlas.com</a> · <a href="${trackUrl(d, "https://wildatlasnp.lovable.app/settings", "footer_unsubscribe")}" style="color:#A09888;">Unsubscribe</a> · <a href="${trackUrl(d, "https://wildatlasnp.lovable.app/privacy", "footer_privacy")}" style="color:#A09888;">Privacy Policy</a> · <a href="${trackUrl(d, "https://wildatlasnp.lovable.app/terms", "footer_terms")}" style="color:#A09888;">Terms of Service</a>
          </div>
          <div style="text-align:center;font-size:9px;color:#C0B8A8;line-height:1.6;margin-top:12px;font-family:-apple-system,sans-serif;">
            You are receiving this because you have an active WildAtlas Pro subscription. Reply to manage your preferences.
          </div>
        </td></tr>

        <!-- TRACKING PIXEL -->
        <tr><td style="height:1px;overflow:hidden;line-height:1px;">
          <img src="${d.trackingBaseUrl}?eid=${d.emailLogId}&t=open" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
        </td></tr>

        <tr><td style="height:32px;"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/**
 * send-pro-nudge
 *
 * Called by a cron/scheduler. Finds Pro users who:
 * 1. Upgraded 24+ hours ago
 * 2. Have ≤1 active watch
 * 3. Haven't received this email yet
 *
 * Sends a one-time nudge, then records it in pro_nudge_emails.
 */
// Preview endpoint — returns rendered HTML without sending
async function handlePreview(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sampleData: NudgeData = {
    firstName: "Alex",
    permitName: "Half Dome",
    parkName: "Yosemite",
    parkId: "yosemite",
    trackingBaseUrl: "https://example.com/track",
    emailLogId: "preview-test",
  };

  const html = buildNudgeHtml(sampleData);
  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Preview route — no auth needed, returns sample HTML
  if (url.pathname.endsWith("/preview")) {
    return handlePreview(req);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  // Only allow cron secret or service role
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = cronSecret && token === cronSecret;
  const isService = token === serviceRoleKey;

  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

  try {
    // Find Pro users who upgraded 24-48 hours ago
    // who haven't received this nudge yet
    // and have ≤ 1 active watch
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Get Pro users who upgraded in the 24-48h window
    const { data: eligibleProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, display_name, notify_email")
      .eq("is_pro", true)
      .eq("notify_email", true)
      .gte("updated_at", fortyEightHoursAgo)
      .lte("updated_at", twentyFourHoursAgo);

    if (profileErr) throw new Error(`Profile query: ${profileErr.message}`);
    if (!eligibleProfiles?.length) {
      console.log("No eligible users for pro nudge");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = eligibleProfiles.map((p) => p.user_id);

    // Filter out users who already received the nudge
    const { data: alreadySent } = await supabase
      .from("pro_nudge_emails")
      .select("user_id")
      .in("user_id", userIds);

    const sentSet = new Set((alreadySent || []).map((r) => r.user_id));
    const remaining = eligibleProfiles.filter((p) => !sentSet.has(p.user_id));

    if (!remaining.length) {
      console.log("All eligible users already received nudge");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const profile of remaining) {
      // Count active watches
      const { count } = await supabase
        .from("active_watches")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.user_id)
        .eq("is_active", true);

      if ((count ?? 0) > 1) {
        // Already tracking multiple — skip but mark as sent so we don't recheck
        await supabase.from("pro_nudge_emails").insert({ user_id: profile.user_id });
        continue;
      }

      // Get their current watch details
      const { data: watches } = await supabase
        .from("active_watches")
        .select("permit_name, park_id")
        .eq("user_id", profile.user_id)
        .eq("is_active", true)
        .limit(1);

      const watch = watches?.[0];
      const permitName = watch?.permit_name || "your permit";
      const parkId = watch?.park_id || "yosemite";
      const parkDisplay = PARK_DISPLAY[parkId] || PARK_DISPLAY.yosemite;

      // Get user email from auth
      const { data: authData } = await supabase.auth.admin.getUserById(profile.user_id);
      const email = authData?.user?.email;
      if (!email) continue;

      const firstName = profile.display_name || email.split("@")[0];

      // Create email log
      const { data: logData } = await supabase
        .from("email_logs")
        .insert({
          recipient_email: email,
          email_type: "pro_nudge",
          status: "sending",
        })
        .select("id")
        .single();

      const emailLogId = logData?.id || "unknown";

      const nudgeData: NudgeData = {
        firstName,
        permitName,
        parkName: parkDisplay.name,
        parkId,
        trackingBaseUrl,
        emailLogId,
      };

      const html = buildNudgeHtml(nudgeData);

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Mochi 🐻 <mochi@alerts.wildatlas.app>",
          to: [email],
          subject: `You're only tracking 1 permit, ${firstName} — you have unlimited 🐻`,
          html,
          headers: {
            "X-Entity-Ref-ID": `pro-nudge-${profile.user_id}`,
            "List-Unsubscribe": "<https://wildatlasnp.lovable.app/settings>",
          },
          tags: [{ name: "category", value: "pro_nudge" }],
        }),
      });

      const resendData = await resendRes.json();

      if (resendRes.ok) {
        await supabase.from("email_logs").update({ status: "sent" }).eq("id", emailLogId);
        await supabase.from("pro_nudge_emails").insert({ user_id: profile.user_id });
        sentCount++;
        console.log(`Pro nudge sent to ${email}`);
      } else {
        await supabase
          .from("email_logs")
          .update({ status: "failed", error_message: JSON.stringify(resendData) })
          .eq("id", emailLogId);
        console.error(`Failed to send pro nudge to ${email}:`, resendData);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, checked: remaining.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-pro-nudge error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
