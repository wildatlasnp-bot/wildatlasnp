import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ParkActivity {
  /** Most recent `recent_finds.found_at` for this park, or null if none. */
  lastAlertAt: string | null;
}

export interface FleetActivity {
  /** Per-park last-alert timestamp keyed by park_id (e.g. "yosemite"). */
  byPark: Record<string, ParkActivity>;
  /** Newest `recent_finds.found_at` across all parks, or null if none. */
  globalLastAlertAt: string | null;
  loading: boolean;
}

/**
 * useFleetActivity — pulls the most recent permit-find timestamp per park
 * from `recent_finds` to drive the landing page Fleet section's recency
 * indicators. Public read-access is allowed by RLS, so this works for
 * unauthenticated visitors.
 *
 * One round trip: fetch the last 200 finds (newest first), then fold into
 * a per-park map. The table is auto-pruned to 100 rows server-side, so 200
 * is comfortably enough to see one row per park when traffic exists.
 */
/** How often to refetch recent_finds while the page is visible. */
const REFETCH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
/** How often to recompute relative captions/underline weights from existing data. */
const TICK_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useFleetActivity(parkIds: string[]): FleetActivity {
  const [state, setState] = useState<FleetActivity>({
    byPark: {},
    globalLastAlertAt: null,
    loading: true,
  });
  // Forces consumers to re-render so formatRecency/recencyStyle recompute
  // against the current wall clock even when no new rows have arrived.
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      const { data, error } = await supabase
        .from("recent_finds")
        .select("park_id, found_at")
        .order("found_at", { ascending: false })
        .limit(200);

      if (cancelled) return;

      const byPark: Record<string, ParkActivity> = {};
      for (const id of parkIds) byPark[id] = { lastAlertAt: null };

      let globalLastAlertAt: string | null = null;

      if (!error && data) {
        for (const row of data) {
          const pid = row.park_id as string;
          const ts = row.found_at as string;
          if (!globalLastAlertAt) globalLastAlertAt = ts;
          if (byPark[pid] && byPark[pid].lastAlertAt === null) {
            byPark[pid].lastAlertAt = ts;
          }
        }
      }

      setState({ byPark, globalLastAlertAt, loading: false });
    };

    // Initial fetch
    fetchOnce();

    // Periodic background refetch — stays light (one query, ~200 rows).
    const refetchId = window.setInterval(fetchOnce, REFETCH_INTERVAL_MS);

    // Lighter ticker so "14M AGO" advances to "15M AGO" without a network hit.
    const tickId = window.setInterval(() => {
      setTick((n) => (n + 1) % 1_000_000);
    }, TICK_INTERVAL_MS);

    // Refresh immediately when the tab comes back into focus, so a viewer
    // returning after lunch sees current data instead of a stale snapshot.
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(refetchId);
      window.clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // parkIds is stable from caller (module-level constant), so this runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/**
 * formatRecency — turns a timestamp into a compact uppercase label suitable
 * for the Fleet section's DM Sans 11px caption.
 *
 * Returns one of:
 *   "ALERTED 14M AGO" (under 1h)
 *   "ALERTED 3H AGO"  (under 24h)
 *   "QUIET · 3D"      (under 7d)
 *   "QUIET · 12D"     (older)
 *   "STANDING BY"     (no data)
 */
export function formatRecency(iso: string | null): string {
  if (!iso) return "STANDING BY";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "ALERTED JUST NOW";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "ALERTED JUST NOW";
  if (mins < 60) return `ALERTED ${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `ALERTED ${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `QUIET · ${days}D`;
}

export interface RecencyStyle {
  opacity: number;
  height: number;
  borderStyle: "solid" | "dashed";
}

/**
 * recencyStyle — converts a last-alert timestamp into the underline visual
 * weight described in the spec:
 *   ≤1h  : 100% opacity, 2px solid
 *   ≤24h : 60% opacity,  2px solid
 *   ≤7d  : 30% opacity,  1px solid
 *   >7d / null : 15% opacity, 1px dashed
 */
export function recencyStyle(iso: string | null): RecencyStyle {
  if (!iso) return { opacity: 0.15, height: 1, borderStyle: "dashed" };
  const ms = Date.now() - new Date(iso).getTime();
  const HOUR = 60 * 60 * 1000;
  if (ms <= 1 * HOUR) return { opacity: 1, height: 2, borderStyle: "solid" };
  if (ms <= 24 * HOUR) return { opacity: 0.6, height: 2, borderStyle: "solid" };
  if (ms <= 7 * 24 * HOUR) return { opacity: 0.3, height: 1, borderStyle: "solid" };
  return { opacity: 0.15, height: 1, borderStyle: "dashed" };
}
