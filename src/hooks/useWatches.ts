import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cacheLocally, getCachedData } from "@/components/OfflineBanner";
import { useProStatus } from "@/hooks/useProStatus";
import posthog from "@/lib/posthog";
import type { Watch } from "@/components/WatchCard";
import type { PermitDefWithPark } from "./usePermitDefs";

// Module-level cache for watches — survives unmount/remount on tab switch
const WATCHES_CACHE_TTL_MS = 60_000; // 60 seconds
let watchesCache: { data: Watch[]; fetchedAt: number; userId: string } | null = null;

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
    created_at: row.created_at,
  };
}

/**
 * Manages watch CRUD, Realtime subscription for "found" events,
 * phone state for SMS, and the success overlay state.
 */
export function useWatches(permitDefsRef: React.RefObject<PermitDefWithPark[]>) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPro, FREE_WATCH_LIMIT } = useProStatus();

  const [watches, setWatches] = useState<Watch[]>([]);
  const watchesByIdRef = useRef<Map<string, Watch>>(new Map());
  const [watchesLoaded, setWatchesLoaded] = useState(false);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState<string | null>(null);

  // Success overlay state
  const [successOpen, setSuccessOpen] = useState(false);
  const [foundPermit, setFoundPermit] = useState<{ name: string; date: string; recgovPermitId?: string | null } | null>(null);

  // Pro modal state
  const [proModalOpen, setProModalOpen] = useState(false);

  // Keep watchesByIdRef and module cache in sync
  useEffect(() => {
    watchesByIdRef.current = new Map(watches.map((w) => [w.id, w]));
    // Update cache data whenever watches state changes (mutations, realtime, etc.)
    if (user && watches.length > 0) {
      watchesCache = { data: watches, fetchedAt: watchesCache?.fetchedAt ?? Date.now(), userId: user.id };
    }
  }, [watches, user]);

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

  // Load watches + Realtime subscription
  useEffect(() => {
    if (!user) {
      setWatchesLoaded(true);
      return;
    }

    const now = Date.now();
    const hasFreshCache = watchesCache && watchesCache.userId === user.id && (now - watchesCache.fetchedAt) < WATCHES_CACHE_TTL_MS;

    if (hasFreshCache) {
      // Use cached data immediately, no fetch needed
      setWatches(watchesCache!.data);
      setWatchesLoaded(true);
      return;
    }

    // If we have stale cache, show it immediately and refresh in background
    const hasStaleCache = watchesCache && watchesCache.userId === user.id;
    if (hasStaleCache) {
      setWatches(watchesCache!.data);
      setWatchesLoaded(true);
      setBackgroundRefreshing(true);
    }

    const load = async () => {
      if (!navigator.onLine) {
        const cached = getCachedData();
        if (cached) setWatches(cached);
        setWatchesLoaded(true);
        setBackgroundRefreshing(false);
        return;
      }

      const { data } = await supabase
        .from("user_watchers")
        .select("*, scan_targets(park_id, permit_type)")
        .eq("user_id", user.id);
      const mapped = data ? data.map(mapWatcherToWatch) : [];
      if (data) {
        setWatches(mapped);
        cacheLocally(mapped);
        watchesCache = { data: mapped, fetchedAt: Date.now(), userId: user.id };
      }

      // Recovery: pending permit from onboarding
      const pendingRaw = localStorage.getItem("wildatlas_pending_permit");
      if (pendingRaw) {
        const loadedActiveCount = mapped.filter((w) => w.is_active).length;
        if (loadedActiveCount === 0) {
          let pending: { permit_name: string; park_id: string } | null = null;
          try { pending = JSON.parse(pendingRaw); } catch { /* ignore */ }
          if (pending) {
            const { data: watcherId, error: recoveryError } = await supabase.rpc("create_or_join_watch", {
              p_user_id: user.id,
              p_park_id: pending.park_id,
              p_permit_name: pending.permit_name,
            });
            if (!recoveryError && watcherId) {
              const { data: newRow } = await supabase
                .from("user_watchers")
                .select("*, scan_targets(park_id, permit_type)")
                .eq("id", watcherId)
                .maybeSingle();
              if (newRow) {
                const newWatch = mapWatcherToWatch(newRow);
                setWatches((prev) => {
                  const u = [...prev, newWatch];
                  cacheLocally(u);
                  watchesCache = { data: u, fetchedAt: Date.now(), userId: user.id };
                  return u;
                });
              }
            }
          }
        }
        localStorage.removeItem("wildatlas_pending_permit");
      }

      setWatchesLoaded(true);
      setBackgroundRefreshing(false);
    };
    load();

    // Realtime: listen for "found" status updates
    const channel = supabase
      .channel("watcher-found")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_watchers", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "found") {
            const existing = watchesByIdRef.current.get(updated.id);
            if (existing) {
              const permitDef = permitDefsRef.current?.find(
                (p) => p.park_id === existing.park_id && p.name === existing.permit_name
              );
              setFoundPermit({
                name: existing.permit_name,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                recgovPermitId: permitDef?.recgov_permit_id,
              });
              setSuccessOpen(true);
            }
            // Background: sync updated status
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
                  const permitDef = permitDefsRef.current?.find(
                    (p) => p.park_id === mappedWatch.park_id && p.name === mappedWatch.permit_name
                  );
                  setFoundPermit({
                    name: mappedWatch.permit_name,
                    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                    recgovPermitId: permitDef?.recgov_permit_id,
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

  const toggleWatch = useCallback(async (permitName: string, parkId: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!navigator.onLine) {
      toast({ title: "No signal!", description: "Looks like you've wandered off the trail. Reconnect and try again." });
      return;
    }
    const existing = watches.find((w) => w.permit_name === permitName && w.park_id === parkId);
    if (!isPro && !existing && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    if (!isPro && existing && !existing.is_active && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    setLoadingId(permitName);
    try {
      if (existing) {
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
          title: newActive ? "Watch activated" : "Watch paused",
          description: newActive ? "Scanning Recreation.gov with frequent automated checks." : "Monitoring paused.",
        });
      } else {
        const { data: watcherId, error } = await supabase.rpc("create_or_join_watch", {
          p_user_id: user.id,
          p_park_id: parkId,
          p_permit_name: permitName,
        });
        if (error) throw error;
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
        window.dispatchEvent(new Event("watches-changed"));
        toast({ title: "Watch activated", description: "Scanning Recreation.gov with frequent automated checks." });
      }
    } catch (e: any) {
      const msg = e?.message || e?.details || "";
      if (msg.includes("Free plan limited")) { setProModalOpen(true); }
      else if (msg.includes("Maximum of")) { toast({ title: "Watch limit reached", description: "You have too many watches. Delete some unused ones to add new ones." }); }
      else { toast({ title: "Trail hiccup", description: "I'm having trouble reaching the park gates. Give me a moment!" }); }
    } finally { setLoadingId(null); }
  }, [user, watches, isPro, activeCount, FREE_WATCH_LIMIT, navigate, toast]);

  const deleteWatch = useCallback(async (watchId: string) => {
    if (!user) return;
    const watch = watches.find((w) => w.id === watchId);
    const { error } = await supabase.from("user_watchers").delete().eq("id", watchId);
    if (error) { toast({ title: "Trail hiccup", description: "Couldn't remove that watch. Try again!" }); return; }
    setWatches((prev) => { const u = prev.filter((w) => w.id !== watchId); cacheLocally(u); return u; });
    window.dispatchEvent(new Event("watches-changed"));
    toast({ title: "Watch removed", description: `${watch?.permit_name ?? "Watch"} has been deleted.` });
  }, [user, watches, toast]);

  const toggleNotify = useCallback(async (watchId: string) => {
    if (!isPro) { setProModalOpen(true); return; }
    const watch = watches.find((w) => w.id === watchId);
    if (!watch || !watch.is_active) return;
    const newVal = !watch.notify_sms;
    if (newVal && !hasPhone) {
      setShowPhoneInput(watchId);
      return;
    }
    const { error } = await supabase.from("user_watchers").update({ notify_sms: newVal }).eq("id", watchId);
    if (!error) setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: newVal } : w));
  }, [isPro, watches, hasPhone]);

  const handlePhoneSaved = useCallback((watchId: string) => {
    setHasPhone(true);
    setShowPhoneInput(null);
    setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: true } : w));
  }, []);

  const getWatchState = useCallback((permitName: string, parkId?: string) =>
    watches.find((w) => w.permit_name === permitName && (!parkId || w.park_id === parkId)),
  [watches]);

  const alertCount = watches.filter((w) => w.notify_sms).length;
  const foundCount = watches.filter((w) => w.status === "found").length;

  return {
    watches,
    watchesLoaded,
    loadingId,
    hasPhone,
    showPhoneInput,
    successOpen,
    foundPermit,
    proModalOpen,
    activeCount,
    alertCount,
    foundCount,

    toggleWatch,
    deleteWatch,
    toggleNotify,
    getWatchState,
    setShowPhoneInput,
    handlePhoneSaved,
    setSuccessOpen,
    setProModalOpen,
  };
}
