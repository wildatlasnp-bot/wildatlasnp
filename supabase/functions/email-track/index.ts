import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { staticCorsHeaders as corsHeaders } from "../_shared/cors.ts";

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(atob(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const emailLogId = url.searchParams.get("eid");
  const eventType = url.searchParams.get("t") || "open"; // "open" or "click"
  const redirectUrl = url.searchParams.get("r"); // for click tracking

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Log the event (non-blocking — don't let failures affect the response)
  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ip_address = rawIp
    ? rawIp.includes(":")
      ? rawIp.replace(/:[^:]+$/, ":0")
      : rawIp.replace(/\.\d+$/, ".0")
    : null;
  try {
    await supabase.from("email_tracking").insert({
      email_log_id: emailLogId || null,
      event_type: eventType,
      link_url: redirectUrl || null,
      user_agent: req.headers.get("user-agent") || null,
      ip_address,
    });
  } catch (e) {
    console.error("Tracking insert failed:", e);
  }

  // For click events, validate redirect URL against allowlist before redirecting
  if (eventType === "click" && redirectUrl) {
    const ALLOWED_ORIGINS = [
      "https://wildatlas.app",
      "https://wildatlasnp.lovable.app",
      "https://wildatlas.lovable.app",
    ];
    let isAllowed = false;
    try {
      const parsed = new URL(redirectUrl);
      isAllowed = ALLOWED_ORIGINS.includes(parsed.origin);
    } catch {
      // unparseable URL
    }
    if (!isAllowed) {
      return new Response("Invalid redirect", { status: 400 });
    }
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
        "Cache-Control": "no-store, no-cache",
      },
    });
  }

  // For open events, return the tracking pixel
  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});
