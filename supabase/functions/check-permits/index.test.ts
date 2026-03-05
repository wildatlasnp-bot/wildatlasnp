import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/check-permits`;

Deno.test("returns 401 without CRON_SECRET", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ time: new Date().toISOString() }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `Expected 401, got ${res.status}: ${body}`);
});

Deno.test("returns 401 with wrong secret", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer wrong-secret-value",
    },
    body: JSON.stringify({ time: new Date().toISOString() }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `Expected 401, got ${res.status}: ${body}`);
});

Deno.test("duplicate enqueue prevention: second run skips watches stamped in first run", async () => {
  // This test uses the service role key to:
  // 1. Create a temporary active watch
  // 2. Invoke check-permits (run 1)
  // 3. Verify last_notified_at was stamped if a permit was found
  // 4. Invoke check-permits (run 2)
  // 5. Verify no duplicate queue entries exist for the same watch
  // 6. Clean up test data

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.log("⏭ Skipping E2E test: SUPABASE_SERVICE_ROLE_KEY not set");
    return;
  }

  const supabase = createClient(SUPABASE_URL, serviceRoleKey);

  // Use a known test user ID (we'll create a fake one and clean up)
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000e2e";
  const TEST_WATCH_ID = "00000000-0000-0000-0000-0000000test1";

  // Clean up any leftover test data from previous runs
  await supabase.from("notification_queue").delete().eq("user_id", TEST_USER_ID);
  await supabase.from("active_watches").delete().eq("id", TEST_WATCH_ID);

  // Pick a real permit from the registry to test against
  const { data: permits } = await supabase
    .from("park_permits")
    .select("name, park_id, recgov_permit_id")
    .eq("is_active", true)
    .not("recgov_permit_id", "is", null)
    .limit(1);

  if (!permits || permits.length === 0) {
    console.log("⏭ Skipping: no active permits with recgov_permit_id");
    return;
  }

  const testPermit = permits[0];

  // Insert a test watch (is_active: true, no last_notified_at)
  const { error: insertErr } = await supabase.from("active_watches").insert({
    id: TEST_WATCH_ID,
    user_id: TEST_USER_ID,
    park_id: testPermit.park_id,
    permit_name: testPermit.name,
    is_active: true,
    status: "searching",
    last_notified_at: null,
  });

  if (insertErr) {
    console.log(`⏭ Skipping: could not create test watch: ${insertErr.message}`);
    return;
  }

  try {
    // ── Run 1: invoke check-permits ──
    const res1 = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ time: new Date().toISOString() }),
    });
    const body1 = await res1.json();
    assertEquals(res1.status, 200, `Run 1 failed: ${JSON.stringify(body1)}`);

    // Check if our test watch found anything (new orchestrator format)
    const workerResult = body1.workerResults?.find((r: any) =>
      r.result?.permitKey === `${testPermit.park_id}:${testPermit.name}`
    );
    const found = workerResult?.result?.found > 0;
    if (!found) {
      console.log("ℹ️ Permit not currently available — testing cooldown stamp path only");

      // Even without a find, verify no queue entry was created
      const { data: q1 } = await supabase
        .from("notification_queue")
        .select("id")
        .eq("watch_id", TEST_WATCH_ID);
      assertEquals(q1?.length ?? 0, 0, "No queue entry should exist when permit not found");
      return;
    }

    // Permit was found — verify last_notified_at was stamped
    const { data: watch1 } = await supabase
      .from("active_watches")
      .select("last_notified_at")
      .eq("id", TEST_WATCH_ID)
      .single();

    assert(watch1?.last_notified_at !== null, "last_notified_at should be stamped after enqueue");

    // Count queue entries after run 1
    const { data: q1 } = await supabase
      .from("notification_queue")
      .select("id")
      .eq("watch_id", TEST_WATCH_ID)
      .eq("status", "pending");

    const run1Count = q1?.length ?? 0;
    assert(run1Count >= 1, `Expected at least 1 queue entry after run 1, got ${run1Count}`);

    // ── Run 2: invoke check-permits again immediately ──
    const res2 = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ time: new Date().toISOString() }),
    });
    const body2 = await res2.json();
    assertEquals(res2.status, 200, `Run 2 failed: ${JSON.stringify(body2)}`);

    // The second run should produce 0 new enqueues for the same permit (cooldown)
    const workerResult2 = body2.workerResults?.find((r: any) =>
      r.result?.permitKey === `${testPermit.park_id}:${testPermit.name}`
    );
    if (workerResult2?.result) {
      assertEquals(
        workerResult2.result.enqueued,
        0,
        `Expected 0 enqueued on run 2, got: ${workerResult2.result.enqueued}`
      );
    }

    // Count queue entries after run 2 — should be same as run 1
    const { data: q2 } = await supabase
      .from("notification_queue")
      .select("id")
      .eq("watch_id", TEST_WATCH_ID)
      .eq("status", "pending");

    const run2Count = q2?.length ?? 0;
    assertEquals(
      run2Count,
      run1Count,
      `Duplicate detected! Run 1: ${run1Count} queue items, Run 2: ${run2Count} queue items`
    );

    console.log(`✅ Cooldown verified: ${run1Count} queue item(s) after both runs (no duplicates)`);
  } finally {
    // Clean up test data
    await supabase.from("notification_queue").delete().eq("user_id", TEST_USER_ID);
    await supabase.from("active_watches").delete().eq("id", TEST_WATCH_ID);
  }
});
