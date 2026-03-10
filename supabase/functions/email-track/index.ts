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
  try {
    await supabase.from("email_tracking").insert({
      email_log_id: emailLogId || null,
      event_type: eventType,
      link_url: redirectUrl || null,
      user_agent: req.headers.get("user-agent") || null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    });
  } catch (e) {
    console.error("Tracking insert failed:", e);
  }

  // For click events, redirect to the target URL
  if (eventType === "click" && redirectUrl) {
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
