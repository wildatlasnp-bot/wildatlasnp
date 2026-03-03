import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildWelcomeHtml = (email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #FAF6F1; font-family: Georgia, 'Times New Roman', serif; color: #2D3B2D; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .mochi { font-size: 48px; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 700; color: #2D3B2D; margin: 0 0 4px; }
    .subtitle { font-size: 13px; color: #8B7D6B; margin: 0; font-style: italic; }
    .card { background: #FFFFFF; border-radius: 16px; padding: 28px 24px; margin-bottom: 24px; border: 1px solid #E8E0D5; }
    .card h2 { font-size: 16px; margin: 0 0 12px; color: #2D3B2D; }
    .card p { font-size: 14px; line-height: 1.7; color: #4A5D4A; margin: 0 0 14px; }
    .highlight-box { background: #F0EBE3; border-radius: 10px; padding: 16px; margin: 16px 0; border-left: 3px solid #C4956A; }
    .highlight-box p { font-size: 13px; color: #6B5D4D; margin: 0; }
    .highlight-box strong { color: #2D3B2D; }
    .cta { display: inline-block; background: #2D3B2D; color: #FFFFFF; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600; font-family: -apple-system, sans-serif; }
    .footer { text-align: center; font-size: 11px; color: #A09888; margin-top: 32px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="mochi">🐻</div>
      <h1 class="title">Welcome to WildAtlas, Ranger!</h1>
      <p class="subtitle">From the desk of Mochi — Tactical Lead</p>
    </div>

    <div class="card">
      <h2>You're on the list.</h2>
      <p>
        Thanks for joining the WildAtlas Pro waitlist. We're building the ultimate 2026 Yosemite companion — and you'll be among the first to access it.
      </p>
      <p>
        While you wait, here are two critical logistics for your 2026 trip:
      </p>

      <div class="highlight-box">
        <p>🅿️ <strong>The 8:30 AM Parking Cutoff</strong> — Yosemite Valley lots fill by 8:30 AM on peak days. WildAtlas Pro will send real-time lot capacity alerts so you can beat the rush.</p>
      </div>

      <div class="highlight-box">
        <p>💰 <strong>New $100 International Fee</strong> — Starting 2026, international visitors pay a $100 entry fee. We'll track deadlines and remind you before your trip.</p>
      </div>

      <p>
        When the 2026 Master Edition launches, Mochi 🐻 will personally alert you. Until then — happy trails!
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://wildatlas.lovable.app" class="cta">Explore WildAtlas →</a>
    </div>

    <div class="footer">
      <p>You're receiving this because ${email} joined the WildAtlas Pro waitlist.<br/>
      WildAtlas — Tactical logistics for the modern ranger.</p>
    </div>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();

    // Support both webhook format and direct call
    const record = payload.record || payload;
    const email = record?.email;

    if (!email) {
      throw new Error("No email found in payload");
    }

    console.log(`Sending welcome email to ${email}`);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mochi 🐻 <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to WildAtlas, Ranger! 🏔️",
        html: buildWelcomeHtml(email),
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    // Log success
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

    // Log failure
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
