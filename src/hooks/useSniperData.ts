import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cacheLocally, getCachedData } from "@/components/OfflineBanner";
import { ALL_PARK_IDS, getParkConfig } from "@/lib/parks";
import { useProStatus } from "@/hooks/useProStatus";
import posthog from "@/lib/posthog";
import type { Watch, PermitDef } from "@/components/WatchCard";

// ─── Module-level cache for park_permits (rarely changes) ────────────────────
const PERMIT_DEFS_TTL_MS = 30 * 60 * 1000; // 30 minutes
let allPermitDefsCache: { data: PermitDefWithPark[]; fetchedAt: number } | null = null;

/** RPC call with timeout */
async function rpcWithTimeout<T>(
  builder: { abortSignal: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: any }> },
  timeoutMs = 10_000
): Promise<{ data: T | null; error: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await builder.abortSignal(controller.signal);
    return result;
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { data: null, error: { message: "Request timed out" } };
    }
    return { data: null, error: { message: e?.message || "Unknown error" } };
  } finally {
    clearTimeout(timer);
  }
}

export interface PermitAvailability {
  id: string;
  park_code: string;
  permit_type: string;
  date: string;
  available_spots: number;
  last_checked: string;
}

export interface PermitDefWithPark extends PermitDef {
  park_id: string;
}

/** Group permit defs by park_id, maintaining display order */
export interface ParkPermitGroup {
  parkId: string;
  parkName: string;
  permits: PermitDefWithPark[];
}

/** Map a user_watcher + scan_target join row into the Watch interface */
function mapWatcherToWatch(row: any): Watch {
  return {
    id: row.id,
    permit_name: row.scan_targets?.permit_type ?? "",
    park_id: row.scan_targets?.park_id ?? "",
    status: row.status,
    is_active: row.is_active,
    notify_sms: row.notify_sms,
    updated_at: row.updated_at,
  };
}

export function useSniperData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPro, FREE_WATCH_LIMIT } = useProStatus();

  const [watches, setWatches] = useState<Watch[]>([]);
  // Ref kept in sync with watches state; used by the Realtime callback to avoid
  // stale-closure issues without a DB round-trip on the critical open path.
  const watchesByIdRef = useRef<Map<string, Watch>>(new Map());
  const [watchesLoaded, setWatchesLoaded] = useState(false);
  const [permitDefs, setPermitDefs] = useState<PermitDefWithPark[]>([]);
  const [availability, setAvailability] = useState<PermitAvailability[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const lastCheckedRef = useRef<string | null>(null);
  const [scanPulse, setScanPulse] = useState(false);
  const prevAvailCountRef = useRef(-1);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [defsLoaded, setDefsLoaded] = useState(false);

  // Check if there's a pending permit from onboarding (prevents empty state flash)
  const [pendingOnboardingPermit] = useState(() => {
    try {
      const raw = localStorage.getItem("wildatlas_pending_permit");
      return raw ? JSON.parse(raw) as { permit_name: string; park_id: string } : null;
    } catch { return null; }
  });

  useEffect(() => {
    watchesByIdRef.current = new Map(watches.map((w) => [w.id, w]));
  }, [watches]);

  // initialLoading is true until BOTH defs and watches have loaded
  const initialLoading = !defsLoaded || !watchesLoaded;
  const [successOpen, setSuccessOpen] = useState(false);
  const [foundPermit, setFoundPermit] = useState<{ name: string; date: string } | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState<string | null>(null);
  const [proModalOpen, setProModalOpen] = useState(false);

  // Stable getTimeAgo — always reads Date.now() at call time, no tick re-renders
  const getTimeAgo = useCallback((dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }, []);

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Fetch availability for ALL parks in parallel
  const fetchAvailability = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await Promise.allSettled(
        ALL_PARK_IDS.map((parkId) =>
          rpcWithTimeout(supabase.rpc("get_permit_availability", { p_park_code: parkId }))
        )
      );

      const allRows: PermitAvailability[] = [];
      let anyError = false;
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data) {
          allRows.push(...(result.value.data as unknown as PermitAvailability[]));
        } else {
          anyError = true;
        }
      }

      if (anyError && allRows.length === 0) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delayMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 16_000);
          setTimeout(() => fetchAvailability(), delayMs);
          return;
        }
        toast({ title: "🐻 Trail hiccup", description: "Couldn't fetch availability. Using cached data." });
        retryCountRef.current = 0;
        return;
      }

      retryCountRef.current = 0;
      const prevCount = prevAvailCountRef.current;
      prevAvailCountRef.current = allRows.length;

      if (prevCount >= 0 && allRows.length > prevCount) {
        const newCount = allRows.length - prevCount;
        toast({
          title: "🎯 New availability detected!",
          description: `${newCount} new permit slot${newCount > 1 ? "s" : ""} just opened up.`,
        });
        posthog.capture("alert_received", { new_slots: newCount });
      }

      setAvailability(allRows);
      if (allRows.length > 0) {
        const latest = allRows.reduce((a, b) => a.last_checked > b.last_checked ? a : b);
        const changed = latest.last_checked !== lastCheckedRef.current;
        lastCheckedRef.current = latest.last_checked;
        setLastChecked(latest.last_checked);
        if (changed) {
          setScanPulse(true);
          setTimeout(() => setScanPulse(false), 1500);
        }
      } else {
        setLastChecked(null);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load ALL permit defs (with module-level cache) + auto-refresh availability
  useEffect(() => {
    const now = Date.now();

    const permitDefsPromise = (allPermitDefsCache && now - allPermitDefsCache.fetchedAt < PERMIT_DEFS_TTL_MS)
      ? Promise.resolve((() => { setPermitDefs(allPermitDefsCache!.data); })())
      : supabase
          .from("park_permits")
          .select("name, description, season_start, season_end, total_finds, park_id")
          .eq("is_active", true)
          .order("park_id")
          .then(({ data }) => {
            if (data) {
              const defs = data as PermitDefWithPark[];
              setPermitDefs(defs);
              allPermitDefsCache = { data: defs, fetchedAt: Date.now() };
            }
          });

    const availPromise = fetchAvailability();

    Promise.allSettled([permitDefsPromise, availPromise]).then(() => {
      setDefsLoaded(true);
    });

    const interval = setInterval(fetchAvailability, 120_000);
    return () => clearInterval(interval);
  }, [fetchAvailability]);

  // Load phone status
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasPhone(!!data?.phone_number));
  }, [user]);

  // Load ALL watches from user_watchers + realtime
  useEffect(() => {
    if (!user) {
      setWatchesLoaded(true);
      return;
    }
    const load = async () => {
      if (!navigator.onLine) {
        const cached = getCachedData();
        if (cached) setWatches(cached);
        setWatchesLoaded(true);
        localStorage.removeItem("wildatlas_pending_permit");
        return;
      }
      const { data } = await supabase
        .from("user_watchers")
        .select("*, scan_targets(park_id, permit_type)")
        .eq("user_id", user.id);
      if (data) {
        const mapped = data.map(mapWatcherToWatch);
        setWatches(mapped);
        cacheLocally(mapped);
      }
      setWatchesLoaded(true);
      localStorage.removeItem("wildatlas_pending_permit");
    };
    load();

    const channel = supabase
      .channel("watcher-found")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_watchers", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "found") {
            // Open overlay immediately from local state — no DB round-trip on critical path.
            // watchesByIdRef always holds the latest watches without stale-closure risk.
            const existing = watchesByIdRef.current.get(updated.id);
            if (existing) {
              setFoundPermit({
                name: existing.permit_name,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              });
              setSuccessOpen(true);
            }
            // Background: sync the watch's updated status into local state.
            // Also handles the edge case where the watch wasn't in local state when Realtime fired.
            supabase
              .from("user_watchers")
              .select("*, scan_targets(park_id, permit_type)")
              .eq("id", updated.id)
              .maybeSingle()
              .then(({ data: freshRow }) => {
                if (!freshRow) return;
                const mappedWatch = mapWatcherToWatch(freshRow);
                setWatches((prev) => prev.map((w) => w.id === mappedWatch.id ? mappedWatch : w));
                if (!existing) {
                  setFoundPermit({
                    name: mappedWatch.permit_name,
                    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  });
                  setSuccessOpen(true);
                }
              });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const activeCount = watches.filter((w) => w.is_active).length;

  /** Group permit defs by park in display order */
  const parkPermitGroups: ParkPermitGroup[] = ALL_PARK_IDS
    .map((parkId) => ({
      parkId,
      parkName: getParkConfig(parkId).shortName,
      permits: permitDefs.filter((p) => p.park_id === parkId),
    }))
    .filter((g) => g.permits.length > 0);

  const toggleWatch = async (permitName: string, parkId: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!navigator.onLine) {
      toast({ title: "🐻 No signal!", description: "Looks like you've wandered off the trail. Reconnect and try again." });
      return;
    }
    const existing = watches.find((w) => w.permit_name === permitName && w.park_id === parkId);
    if (!isPro && !existing && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    if (!isPro && existing && !existing.is_active && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    setLoadingId(permitName);
    try {
      if (existing) {
        // Toggle existing watcher
        const newActive = !existing.is_active;
        const newStatus = newActive ? "searching" : "paused";
        const { error } = await supabase
          .from("user_watchers")
          .update({ is_active: newActive, status: newStatus })
          .eq("id", existing.id);
        if (error) throw error;
        setWatches((prev) => {
          const u = prev.map((w) => w.id === existing.id ? { ...w, is_active: newActive, status: newStatus } : w);
          cacheLocally(u);
          return u;
        });
        toast({
          title: newActive ? "🎯 Watch activated" : "⏸️ Watch paused",
          description: newActive ? "Scanning Recreation.gov as often as every 2 minutes." : "Monitoring paused.",
        });
      } else {
        // Create new watch via security definer function
        const { data: watcherId, error } = await supabase.rpc("create_or_join_watch", {
          p_user_id: user.id,
          p_park_id: parkId,
          p_permit_name: permitName,
        });
        if (error) throw error;

        // Fetch the newly created watcher with joined scan_target
        const { data: newRow } = await supabase
          .from("user_watchers")
          .select("*, scan_targets(park_id, permit_type)")
          .eq("id", watcherId)
          .maybeSingle();

        if (newRow) {
          const mapped = mapWatcherToWatch(newRow);
          setWatches((prev) => { const u = [...prev, mapped]; cacheLocally(u); return u; });
        }

        posthog.capture("permit_tracker_added", { permit_name: permitName, park_id: parkId });
        toast({ title: "🎯 Watch activated", description: "Scanning Recreation.gov as often as every 2 minutes." });
      }
    } catch (e: any) {
      const msg = e?.message || e?.details || "";
      if (msg.includes("Free plan limited")) { setProModalOpen(true); }
      else if (msg.includes("Maximum of")) { toast({ title: "🐻 Watch limit reached", description: "You have too many watches. Delete some unused ones to add new ones." }); }
      else { toast({ title: "🐻 Trail hiccup", description: "I'm having trouble reaching the park gates. Give me a moment!" }); }
    } finally { setLoadingId(null); }
  };

  const deleteWatch = async (watchId: string) => {
    if (!user) return;
    const watch = watches.find((w) => w.id === watchId);
    const { error } = await supabase.from("user_watchers").delete().eq("id", watchId);
    if (error) { toast({ title: "🐻 Trail hiccup", description: "Couldn't remove that watch. Try again!" }); return; }
    setWatches((prev) => { const u = prev.filter((w) => w.id !== watchId); cacheLocally(u); return u; });
    toast({ title: "🗑️ Watch removed", description: `${watch?.permit_name ?? "Watch"} has been deleted.` });
  };

  const toggleNotify = async (watchId: string) => {
    if (!isPro) { setProModalOpen(true); return; }
    const watch = watches.find((w) => w.id === watchId);
    if (!watch || !watch.is_active) return;
    const newVal = !watch.notify_sms;
    const { error } = await supabase.from("user_watchers").update({ notify_sms: newVal }).eq("id", watchId);
    if (!error) setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: newVal } : w));
  };

  const handlePhoneSaved = (watchId: string) => {
    setHasPhone(true);
    setShowPhoneInput(null);
    setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: true } : w));
  };

  const getWatchState = (permitName: string, parkId?: string) =>
    watches.find((w) => w.permit_name === permitName && (!parkId || w.park_id === parkId));
  const getAvailability = (permitName: string, parkCode?: string) =>
    availability.filter((a) => a.permit_type === permitName && (!parkCode || a.park_code === parkCode));
  const alertCount = watches.filter((w) => w.notify_sms).length;
  const foundCount = watches.filter((w) => w.status === "found").length;
  const totalAvailDates = availability.length;

  return {
    user, isPro, FREE_WATCH_LIMIT, initialLoading,
    watches, permitDefs, parkPermitGroups, availability,
    lastChecked, scanPulse, refreshing,
    loadingId, hasPhone, showPhoneInput,
    successOpen, foundPermit, proModalOpen,
    activeCount, alertCount, foundCount, totalAvailDates,
    pendingOnboardingPermit,
    getTimeAgo, getWatchState, getAvailability,
    fetchAvailability,
    toggleWatch, deleteWatch, toggleNotify,
    setShowPhoneInput, handlePhoneSaved,
    setSuccessOpen, setProModalOpen,
  };
}
