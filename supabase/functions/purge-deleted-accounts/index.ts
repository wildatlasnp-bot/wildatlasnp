import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (step: string, details?: unknown) => {
  const d = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[PURGE-DELETED] ${step}${d}`);
};

serve(async (req) => {
  try {
    // Authenticate via CRON_SECRET
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find profiles past their grace period
    const { data: expiredProfiles, error: queryError } = await adminClient
      .from("profiles")
      .select("user_id")
      .not("scheduled_deletion_at", "is", null)
      .lte("scheduled_deletion_at", new Date().toISOString());

    if (queryError) {
      log("Query error", { error: queryError.message });
      return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      log("No expired accounts to purge");
      return new Response(JSON.stringify({ purged: 0 }), { status: 200 });
    }

    log(`Found ${expiredProfiles.length} expired account(s) to purge`);

    let purged = 0;
    let errors = 0;

    for (const profile of expiredProfiles) {
      const userId = profile.user_id;
      try {
        // Delete user data in dependency order
        await adminClient.from("notification_queue").delete().eq("user_id", userId);
        await adminClient.from("notification_log").delete().eq("user_id", userId);
        await adminClient.from("crowd_report_events").delete().eq("user_id", userId);
        await adminClient.from("phone_verifications").delete().eq("user_id", userId);
        await adminClient.from("pro_nudge_emails").delete().eq("user_id", userId);
        await adminClient.from("user_watchers").delete().eq("user_id", userId);
        await adminClient.from("active_watches").delete().eq("user_id", userId);
        await adminClient.from("pro_waitlist").delete().eq("user_id", userId);
        await adminClient.from("profiles").delete().eq("user_id", userId);
        await adminClient.from("user_roles").delete().eq("user_id", userId);

        // Delete auth user
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteError) {
          log("Failed to delete auth user", { userId, error: deleteError.message });
          errors++;
          continue;
        }

        log("Account purged", { userId });
        purged++;
      } catch (err) {
        log("Purge error for user", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    log("Purge complete", { purged, errors });
    return new Response(JSON.stringify({ purged, errors }), { status: 200 });
  } catch (e) {
    console.error("purge-deleted-accounts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
    });
  }
});
