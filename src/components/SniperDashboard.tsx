import { Bell, CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import { cacheLocally, getCachedData } from "@/components/OfflineBanner";
import { DEFAULT_PARK_ID } from "@/lib/parks";
import ParkSelector from "@/components/ParkSelector";
import WatchCard, { type Watch, type PermitDef } from "@/components/WatchCard";

interface SniperProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
}

const SniperDashboard = ({ parkId: parkIdProp, onParkChange }: SniperProps = {}) => {
  const [parkId, setParkId] = useState(parkIdProp ?? DEFAULT_PARK_ID);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [permitDefs, setPermitDefs] = useState<PermitDef[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [tick, setTick] = useState(0);
  const arrivalDateStr = localStorage.getItem("wildatlas_arrival_date");
  const arrivalDate = arrivalDateStr ? new Date(arrivalDateStr) : null;

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

  useEffect(() => {
    supabase
      .from("park_permits")
      .select("name, description, season_start, season_end")
      .eq("park_id", parkId)
      .eq("is_active", true)
      .then(({ data }) => { if (data) setPermitDefs(data); });
  }, [parkId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasPhone(!!data?.phone_number));
  }, [user]);

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
  }, [user, parkId]);

  const handleParkChange = (id: string) => { setParkId(id); onParkChange?.(id); };

  const toggleWatch = async (permitName: string) => {
    if (!user) return;
    if (!navigator.onLine) {
      toast({ title: "🐻 No signal!", description: "Looks like you've wandered off the trail. Reconnect and try again." });
      return;
    }
    setLoadingId(permitName);
    const existing = watches.find((w) => w.permit_name === permitName);
    try {
      if (existing) {
        const newActive = !existing.is_active;
        const newStatus = newActive ? "live" : "searching";
        const { error } = await supabase.from("active_watches").update({ is_active: newActive, status: newStatus }).eq("id", existing.id);
        if (error) throw error;
        setWatches((prev) => { const u = prev.map((w) => w.id === existing.id ? { ...w, is_active: newActive, status: newStatus } : w); cacheLocally(u); return u; });
        toast({ title: newActive ? "🎯 Watch activated" : "⏸️ Watch paused", description: newActive ? "Scanning Recreation.gov every 60 seconds." : "Monitoring paused." });
      } else {
        const { data, error } = await supabase.from("active_watches").insert({ user_id: user.id, permit_name: permitName, park_id: parkId, status: "live", is_active: true, notify_sms: false }).select().single();
        if (error) throw error;
        setWatches((prev) => { const u = [...prev, data]; cacheLocally(u); return u; });
        toast({ title: "🎯 Watch activated", description: "Scanning Recreation.gov every 60 seconds." });
      }
    } catch (e: any) {
      toast({ title: "🐻 Trail hiccup", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } finally {
      setLoadingId(null);
    }
  };

  const toggleNotify = async (watchId: string) => {
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
  const activeCount = watches.filter((w) => w.is_active).length;
  const alertCount = watches.filter((w) => w.notify_sms).length;
  const foundCount = watches.filter((w) => w.status === "found").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-secondary tracking-widest uppercase">Permit Sniper</p>
          <ParkSelector activeParkId={parkId} onParkChange={handleParkChange} />
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Live
            </span>
          )}
        </div>
        <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">Active Watches</h1>
        <p className="text-sm text-muted-foreground mt-1">We'll ping you when a slot opens.</p>
        {arrivalDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-secondary font-medium">
            <CalendarIcon size={12} />
            <span>Trip: {format(arrivalDate, "MMMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Watching", value: String(activeCount), cls: "bg-primary/8 text-primary" },
          { label: "Alerts On", value: String(alertCount), cls: "bg-secondary/10 text-secondary" },
          { label: "Found", value: String(foundCount), cls: foundCount > 0 ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3.5 text-center ${s.cls}`}>
            <div className="text-xl font-heading font-bold">{s.value}</div>
            <div className="text-[10px] font-medium mt-0.5 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-6">
        {permitDefs.map((permit, i) => (
          <WatchCard
            key={permit.name}
            permit={permit}
            watch={getWatchState(permit.name)}
            index={i}
            isLoading={loadingId === permit.name}
            hasPhone={hasPhone}
            userId={user?.id ?? ""}
            showPhoneInput={showPhoneInput}
            getTimeAgo={getTimeAgo}
            onToggleWatch={toggleWatch}
            onToggleNotify={toggleNotify}
            onTogglePhoneInput={setShowPhoneInput}
            onPhoneSaved={handlePhoneSaved}
          />
        ))}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => setSuccessOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 text-primary py-3 text-[13px] font-semibold hover:bg-primary/10 transition-colors"
        >
          <Bell size={15} />
          Test Notification
        </motion.button>
      </div>

      <PermitSuccessOverlay open={successOpen} onClose={() => setSuccessOpen(false)} />
    </div>
  );
};

export default SniperDashboard;
