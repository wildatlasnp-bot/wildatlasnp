import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

const htmlSuccess = (settingsUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribed — WildAtlas</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    body{margin:0;padding:0;background:#F0EDEA;font-family:'DM Sans',-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;width:90%;text-align:center;box-shadow:0 2px 24px rgba(0,0,0,0.06);}
    .icon{font-size:48px;margin-bottom:16px;}
    h1{font-size:22px;font-weight:600;color:#2D3B2D;margin:0 0 12px;line-height:1.3;}
    p{font-size:14px;color:#6B7B6B;line-height:1.7;margin:0 0 28px;}
    a.btn{display:inline-block;background:#2F6F4E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x2705;</div>
    <h1>You&#x2019;ve been unsubscribed.</h1>
    <p>You&#x2019;ve been unsubscribed from WildAtlas email alerts. You can re-enable emails anytime in Settings.</p>
    <a class="btn" href="${settingsUrl}">Manage preferences</a>
  </div>
</body>
</html>`;

const htmlError = (settingsUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invalid link — WildAtlas</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    body{margin:0;padding:0;background:#F0EDEA;font-family:'DM Sans',-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;width:90%;text-align:center;box-shadow:0 2px 24px rgba(0,0,0,0.06);}
    .icon{font-size:48px;margin-bottom:16px;}
    h1{font-size:22px;font-weight:600;color:#2D3B2D;margin:0 0 12px;line-height:1.3;}
    p{font-size:14px;color:#6B7B6B;line-height:1.7;margin:0 0 28px;}
    a.btn{display:inline-block;background:#2F6F4E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x26A0;&#xFE0F;</div>
    <h1>Invalid unsubscribe link.</h1>
    <p>This unsubscribe link is invalid or has expired. Please manage your preferences in Settings.</p>
    <a class="btn" href="${settingsUrl}">Go to Settings</a>
  </div>
</body>
</html>`;

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
  const appBaseUrl = Deno.env.get("APP_URL") ?? "https://wildatlas.app";
  const settingsUrl = `${appBaseUrl}/settings`;

  if (!supabaseUrl || !serviceRoleKey || !unsubscribeSecret) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isGet = req.method === "GET";
  const isPost = req.method === "POST";

  if (!isGet && !isPost) {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");
  const token = url.searchParams.get("token");

  if (!uid || !token) {
    if (isPost) {
      return new Response(JSON.stringify({ error: "Missing uid or token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(htmlError(settingsUrl), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const valid = await verifyUnsubscribeToken(uid, token, unsubscribeSecret);

  if (!valid) {
    if (isPost) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(htmlError(settingsUrl), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("profiles")
    .update({ notify_email: false })
    .eq("user_id", uid);

  if (error) {
    console.error("[unsubscribe] DB update failed:", error.message);
    if (isPost) {
      return new Response(JSON.stringify({ error: "Failed to unsubscribe" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(htmlError(settingsUrl), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  console.log(`[unsubscribe] notify_email=false for user ${uid.slice(0, 8)}... (${isPost ? "POST/one-click" : "GET"})`);

  if (isPost) {
    return new Response(null, { status: 204 });
  }

  return new Response(htmlSuccess(settingsUrl), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
