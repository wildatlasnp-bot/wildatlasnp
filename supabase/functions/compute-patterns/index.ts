import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/** IANA timezone offsets (hours behind UTC). DST-aware approximation using month. */
const TZ_OFFSETS: Record<string, { standard: number; dst: number; dstStart: number; dstEnd: number }> = {
  "America/Los_Angeles": { standard: -8, dst: -7, dstStart: 3, dstEnd: 11 },
  "America/Denver":      { standard: -7, dst: -6, dstStart: 3, dstEnd: 11 },
  "America/Chicago":     { standard: -6, dst: -5, dstStart: 3, dstEnd: 11 },
  "America/New_York":    { standard: -5, dst: -4, dstStart: 3, dstEnd: 11 },
};

function getLocalHour(utcDate: Date, timezone: string): number {
  const tz = TZ_OFFSETS[timezone];
  if (!tz) return utcDate.getUTCHours(); // fallback to UTC
  const month = utcDate.getUTCMonth() + 1; // 1-indexed
  const offset = (month >= tz.dstStart && month < tz.dstEnd) ? tz.dst : tz.standard;
  const localHour = (utcDate.getUTCHours() + offset + 24) % 24;
  return localHour;
}

function getLocalDay(utcDate: Date, timezone: string): number {
  const tz = TZ_OFFSETS[timezone];
  if (!tz) return utcDate.getUTCDay();
  const month = utcDate.getUTCMonth() + 1;
  const offset = (month >= tz.dstStart && month < tz.dstEnd) ? tz.dst : tz.standard;
  // Create a shifted date to get the correct local day
  const localMs = utcDate.getTime() + offset * 3600_000;
  return new Date(localMs).getUTCDay();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Auth guard
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (cronSecret) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token !== cronSecret && token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  try {
    // Compute for the past 7-day window ending yesterday
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() - 1);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekStartIso = weekStart.toISOString();
    const weekEndIso = weekEnd.toISOString();

    console.log(`📊 Computing patterns for week: ${weekStartStr} to ${weekEnd.toISOString().split("T")[0]}`);

    // ── Load park timezone lookup ──────────────────────────────────────
    const { data: parkRows } = await supabase
      .from("parks")
      .select("id, timezone");
    const tzLookup = new Map<string, string>();
    for (const p of parkRows ?? []) tzLookup.set(p.id, p.timezone);

    // ── Permit patterns ─────────────────────────────────────────────────
    const { data: finds } = await supabase
      .from("recent_finds")
      .select("park_id, permit_name, found_at, location_name, available_count")
      .gte("found_at", weekStartIso)
      .lte("found_at", weekEndIso);

    // Group by park_id:permit_name
    const permitGroups: Record<string, any[]> = {};
    for (const f of finds ?? []) {
      const key = `${f.park_id}::${f.permit_name}`;
      if (!permitGroups[key]) permitGroups[key] = [];
      permitGroups[key].push(f);
    }

    const permitRows: any[] = [];
    for (const [key, events] of Object.entries(permitGroups)) {
      const [parkSlug, permitType] = key.split("::");
      const tz = tzLookup.get(parkSlug) ?? "America/Los_Angeles";
      const hours = events.map((e: any) => getLocalHour(new Date(e.found_at), tz));
      hours.sort((a: number, b: number) => a - b);
      const medianHour = hours[Math.floor(hours.length / 2)];

      // Peak hours: top 3 most frequent (local timezone)
      const hourCounts: Record<number, number> = {};
      const dayCounts: Record<number, number> = {};
      const locCounts: Record<string, number> = {};
      for (const e of events) {
        const d = new Date(e.found_at);
        const h = getLocalHour(d, tz);
        const day = getLocalDay(d, tz);
        hourCounts[h] = (hourCounts[h] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
        if (e.location_name) locCounts[e.location_name] = (locCounts[e.location_name] || 0) + 1;
      }

      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h]) => parseInt(h));
      const peakDays = Object.entries(dayCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([d]) => parseInt(d));
      const topLocs = Object.entries(locCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([l]) => l);

      // Alert latency + success rate from notification_log
      const { data: alerts } = await supabase
        .from("notification_log")
        .select("status, latency_seconds")
        .eq("park_id", parkSlug)
        .eq("permit_name", permitType)
        .gte("created_at", weekStartIso)
        .lte("created_at", weekEndIso);

      let avgLatency: number | null = null;
      let successRate: number | null = null;
      if (alerts && alerts.length > 0) {
        const latencies = alerts
          .filter((a: any) => a.latency_seconds != null)
          .map((a: any) => Number(a.latency_seconds));
        if (latencies.length > 0) {
          avgLatency = Math.round(latencies.reduce((s: number, v: number) => s + v, 0) / latencies.length);
        }
        const sent = alerts.filter((a: any) => a.status === "sent").length;
        successRate = Math.round((sent / alerts.length) * 100) / 100;
      }

      permitRows.push({
        park_slug: parkSlug,
        week_start: weekStartStr,
        permit_type: permitType,
        detections_count: events.length,
        median_detection_hour_local: medianHour,
        peak_hours_top3: peakHours,
        peak_days_top2: peakDays,
        avg_alert_latency_seconds: avgLatency,
        alert_success_rate: successRate,
        top_locations: topLocs,
      });
    }

    if (permitRows.length > 0) {
      const { error } = await supabase
        .from("permit_pattern_weekly")
        .upsert(permitRows, { onConflict: "park_slug,week_start,permit_type" });
      if (error) console.error("permit_pattern_weekly upsert error:", error.message);
      else console.log(`✅ Upserted ${permitRows.length} permit pattern rows`);
    }

    // ── Crowd patterns ──────────────────────────────────────────────────
    const { data: reports } = await supabase
      .from("crowd_report_events")
      .select("park_slug, area_name, crowd_level, wait_time_minutes, reported_at")
      .gte("reported_at", weekStartIso)
      .lte("reported_at", weekEndIso);

    const crowdGroups: Record<string, any[]> = {};
    for (const r of reports ?? []) {
      const key = `${r.park_slug}::${r.area_name}`;
      if (!crowdGroups[key]) crowdGroups[key] = [];
      crowdGroups[key].push(r);
    }

    const crowdRows: any[] = [];
    for (const [key, events] of Object.entries(crowdGroups)) {
      const [parkSlug, areaName] = key.split("::");
      const tz = tzLookup.get(parkSlug) ?? "America/Los_Angeles";

      const hourCounts: Record<number, number> = {};
      const partCounts: Record<string, number> = {};
      const levelCounts: Record<string, number> = {};
      const waits: number[] = [];

      for (const e of events) {
        const h = getLocalHour(new Date(e.reported_at), tz);
        hourCounts[h] = (hourCounts[h] || 0) + 1;

        const part = h < 10 ? "morning" : h < 14 ? "midday" : h < 18 ? "afternoon" : "evening";
        partCounts[part] = (partCounts[part] || 0) + 1;
        levelCounts[e.crowd_level] = (levelCounts[e.crowd_level] || 0) + 1;
        if (e.wait_time_minutes != null) waits.push(e.wait_time_minutes);
      }

      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h]) => parseInt(h));
      const busiestParts = Object.entries(partCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([p]) => p);
      const mostCommon = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const avgWait = waits.length > 0 ? Math.round(waits.reduce((s, v) => s + v, 0) / waits.length) : null;

      crowdRows.push({
        park_slug: parkSlug,
        week_start: weekStartStr,
        area_name: areaName,
        reports_count: events.length,
        peak_crowd_hours_top3: peakHours,
        busiest_day_parts: busiestParts,
        avg_wait_time_minutes: avgWait,
        most_common_crowd_level: mostCommon,
      });
    }

    if (crowdRows.length > 0) {
      const { error } = await supabase
        .from("crowd_pattern_weekly")
        .upsert(crowdRows, { onConflict: "park_slug,week_start,area_name" });
      if (error) console.error("crowd_pattern_weekly upsert error:", error.message);
      else console.log(`✅ Upserted ${crowdRows.length} crowd pattern rows`);
    }

    // ── Prune old crowd reports (90 days) ─────────────────────────────
    const { error: pruneErr } = await supabase
      .from("crowd_report_events")
      .delete()
      .lt("reported_at", new Date(Date.now() - 90 * 86400_000).toISOString());
    if (pruneErr) console.error("Prune error:", pruneErr.message);

    return new Response(
      JSON.stringify({
        permitPatterns: permitRows.length,
        crowdPatterns: crowdRows.length,
        week: weekStartStr,
      }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compute-patterns error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
