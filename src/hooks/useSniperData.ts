import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cacheLocally, getCachedData } from "@/components/OfflineBanner";
import { DEFAULT_PARK_ID } from "@/lib/parks";
import { useProStatus } from "@/hooks/useProStatus";
import type { Watch, PermitDef } from "@/components/WatchCard";

// ─── Module-level cache for park_permits (rarely changes) ────────────────────
const PERMIT_DEFS_TTL_MS = 30 * 60 * 1000; // 30 minutes
const permitDefsCache = new Map<string, { data: PermitDef[]; fetchedAt: number }>();

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

export function useSniperData(parkIdProp?: string, onParkChange?: (id: string) => void) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPro, FREE_WATCH_LIMIT } = useProStatus();

  const [parkId, setParkId] = useState(parkIdProp ?? DEFAULT_PARK_ID);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [permitDefs, setPermitDefs] = useState<PermitDef[]>([]);
  const [availability, setAvailability] = useState<PermitAvailability[]>([]);
  const [lastFinds, setLastFinds] = useState<Record<string, string>>({});
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const lastCheckedRef = useRef<string | null>(null);
  const [scanPulse, setScanPulse] = useState(false);
  const prevAvailCountRef = useState(() => ({ current: -1 }))[0];
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [foundPermit, setFoundPermit] = useState<{ name: string; date: string } | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState<string | null>(null);
  const [proModalOpen, setProModalOpen] = useState(false);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = useCallback((dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAvailability = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await rpcWithTimeout(
        supabase.rpc("get_permit_availability", { p_park_code: parkId })
      );
      if (error) {
        console.error("get_permit_availability error:", error.message);
        toast({ title: "🐻 Trail hiccup", description: "Couldn't fetch availability. Using cached data." });
        return;
      }
      if (data) {
        const rows = data as unknown as PermitAvailability[];
        const prevCount = prevAvailCountRef.current;
        prevAvailCountRef.current = rows.length;

        if (prevCount >= 0 && rows.length > prevCount) {
          const newCount = rows.length - prevCount;
          toast({
            title: "🎯 New availability detected!",
            description: `${newCount} new permit slot${newCount > 1 ? "s" : ""} just opened up.`,
          });
        }

        setAvailability(rows);
        if (rows.length > 0) {
          const latest = rows.reduce((a, b) => a.last_checked > b.last_checked ? a : b);
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
      }
    } finally {
      setRefreshing(false);
    }
  }, [parkId]);

  // Load permit defs (with module-level cache) + auto-refresh availability
  useEffect(() => {
    const cached = permitDefsCache.get(parkId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < PERMIT_DEFS_TTL_MS) {
      setPermitDefs(cached.data);
    } else {
      supabase
        .from("park_permits")
        .select("name, description, season_start, season_end, total_finds")
        .eq("park_id", parkId)
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) {
            setPermitDefs(data);
            permitDefsCache.set(parkId, { data, fetchedAt: Date.now() });
          }
        });
    }

    // Fetch last find per permit
    supabase
      .from("recent_finds")
      .select("permit_name, found_at")
      .eq("park_id", parkId)
      .order("found_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          for (const row of data) {
            if (!map[row.permit_name]) map[row.permit_name] = row.found_at;
          }
          setLastFinds(map);
        }
      });

    fetchAvailability();
    const interval = setInterval(fetchAvailability, 120_000);
    return () => clearInterval(interval);
  }, [parkId, fetchAvailability]);

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

  // Load watches + realtime
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (!navigator.onLine) {
        const cached = getCachedData();
        if (cached) setWatches(cached);
        return;
      }
      const { data } = await supabase
        .from("active_watches")
        .select("*")
        .eq("user_id", user.id)
        .eq("park_id", parkId);
      if (data) { setWatches(data); cacheLocally(data); }
    };
    load();

    const channel = supabase
      .channel("watch-found")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "active_watches", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Watch;
          if (updated.status === "found" && updated.park_id === parkId) {
            setWatches((prev) => prev.map((w) => w.id === updated.id ? { ...updated } : w));
            setFoundPermit({ name: updated.permit_name, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
            setSuccessOpen(true);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, parkId]);

  const handleParkChange = (id: string) => { setParkId(id); onParkChange?.(id); };

  const activeCount = watches.filter((w) => w.is_active).length;

  const toggleWatch = async (permitName: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!navigator.onLine) {
      toast({ title: "🐻 No signal!", description: "Looks like you've wandered off the trail. Reconnect and try again." });
      return;
    }
    const existing = watches.find((w) => w.permit_name === permitName);
    if (!isPro && !existing && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    if (!isPro && existing && !existing.is_active && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
    setLoadingId(permitName);
    try {
      if (existing) {
        const newActive = !existing.is_active;
        const newStatus = newActive ? "live" : "searching";
        const { error } = await supabase.from("active_watches").update({ is_active: newActive, status: newStatus }).eq("id", existing.id);
        if (error) throw error;
        setWatches((prev) => { const u = prev.map((w) => w.id === existing.id ? { ...w, is_active: newActive, status: newStatus } : w); cacheLocally(u); return u; });
        toast({ title: newActive ? "🎯 Watch activated" : "⏸️ Watch paused", description: newActive ? "Scanning Recreation.gov as often as every 2 minutes." : "Monitoring paused." });
      } else {
        const { data, error } = await supabase.from("active_watches").insert({ user_id: user.id, permit_name: permitName, park_id: parkId, status: "live", is_active: true, notify_sms: false }).select().single();
        if (error) throw error;
        setWatches((prev) => { const u = [...prev, data]; cacheLocally(u); return u; });
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
    const { error } = await supabase.from("active_watches").delete().eq("id", watchId);
    if (error) { toast({ title: "🐻 Trail hiccup", description: "Couldn't remove that watch. Try again!" }); return; }
    setWatches((prev) => { const u = prev.filter((w) => w.id !== watchId); cacheLocally(u); return u; });
    toast({ title: "🗑️ Watch removed", description: `${watch?.permit_name ?? "Watch"} has been deleted.` });
  };

  const toggleNotify = async (watchId: string) => {
    if (!isPro) { setProModalOpen(true); return; }
    const watch = watches.find((w) => w.id === watchId);
    if (!watch || !watch.is_active) return;
    const newVal = !watch.notify_sms;
    const { error } = await supabase.from("active_watches").update({ notify_sms: newVal }).eq("id", watchId);
    if (!error) setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: newVal } : w));
  };

  const handlePhoneSaved = (watchId: string) => {
    setHasPhone(true);
    setShowPhoneInput(null);
    setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: true } : w));
  };

  const getWatchState = (permitName: string) => watches.find((w) => w.permit_name === permitName);
  const getAvailability = (permitName: string) => availability.filter((a) => a.permit_type === permitName);
  const getLastFind = (permitName: string) => lastFinds[permitName] ?? null;
  const alertCount = watches.filter((w) => w.notify_sms).length;
  const foundCount = watches.filter((w) => w.status === "found").length;
  const totalAvailDates = availability.length;

  return {
    parkId, user, isPro, FREE_WATCH_LIMIT,
    watches, permitDefs, availability,
    lastChecked, scanPulse, refreshing,
    loadingId, hasPhone, showPhoneInput,
    successOpen, foundPermit, proModalOpen,
    activeCount, alertCount, foundCount, totalAvailDates,
    getTimeAgo, getWatchState, getAvailability,
    fetchAvailability, handleParkChange,
    toggleWatch, deleteWatch, toggleNotify,
    setShowPhoneInput, handlePhoneSaved,
    setSuccessOpen, setProModalOpen,
  };
}
