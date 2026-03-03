import { Bell, CalendarIcon, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import { cacheLocally, getCachedData } from "@/components/OfflineBanner";
import { DEFAULT_PARK_ID, getPermitIcon, getParkConfig } from "@/lib/parks";
import ParkSelector from "@/components/ParkSelector";

interface Watch {
  id: string;
  permit_name: string;
  park_id: string;
  status: string;
  is_active: boolean;
  notify_sms: boolean;
}

interface PermitDef {
  name: string;
  description: string | null;
  season_start: string | null;
  season_end: string | null;
}

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
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const arrivalDateStr = localStorage.getItem("wildatlas_arrival_date");
  const arrivalDate = arrivalDateStr ? new Date(arrivalDateStr) : null;

  // Load permit definitions from DB — reload when park changes
  useEffect(() => {
    supabase
      .from("park_permits")
      .select("name, description, season_start, season_end")
      .eq("park_id", parkId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setPermitDefs(data);
      });
  }, [parkId]);

  // Check if user has a phone number saved
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setHasPhone(!!data?.phone_number);
      });
  }, [user]);

  // Load watches from DB — reload when park changes
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
      if (data) {
        setWatches(data);
        cacheLocally(data);
      }
    };
    load();
  }, [user, parkId]);

  const handleParkChange = (id: string) => {
    setParkId(id);
    onParkChange?.(id);
  };

  const toggleWatch = async (permitName: string) => {
    if (!user) return;

    if (!navigator.onLine) {
      toast({
        title: "You're offline",
        description: "Reconnect to toggle watches. Your current settings are saved locally.",
        variant: "destructive",
      });
      return;
    }

    setLoadingId(permitName);

    const existing = watches.find((w) => w.permit_name === permitName);
    try {
      if (existing) {
        const newActive = !existing.is_active;
        const newStatus = newActive ? "live" : "searching";
        const { error } = await supabase
          .from("active_watches")
          .update({ is_active: newActive, status: newStatus })
          .eq("id", existing.id);
        if (error) throw error;
        setWatches((prev) => {
          const updated = prev.map((w) =>
            w.id === existing.id ? { ...w, is_active: newActive, status: newStatus } : w
          );
          cacheLocally(updated);
          return updated;
        });
        toast({
          title: newActive ? "🎯 Watch activated" : "⏸️ Watch paused",
          description: newActive
            ? "WildAtlas is now scanning Recreation.gov every 60 seconds."
            : "Monitoring paused. Toggle back on anytime.",
        });
      } else {
        const { data, error } = await supabase
          .from("active_watches")
          .insert({ user_id: user.id, permit_name: permitName, park_id: parkId, status: "live", is_active: true, notify_sms: false })
          .select()
          .single();
        if (error) throw error;
        setWatches((prev) => {
          const updated = [...prev, data];
          cacheLocally(updated);
          return updated;
        });
        toast({
          title: "🎯 Watch activated",
          description: "WildAtlas is now scanning Recreation.gov every 60 seconds.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Something went wrong",
        description: e.message || "Couldn't update watch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const toggleNotify = async (watchId: string) => {
    const watch = watches.find((w) => w.id === watchId);
    if (!watch || !watch.is_active) return;
    const newVal = !watch.notify_sms;
    const { error } = await supabase
      .from("active_watches")
      .update({ notify_sms: newVal })
      .eq("id", watchId);
    if (!error) {
      setWatches((prev) => prev.map((w) => w.id === watchId ? { ...w, notify_sms: newVal } : w));
    }
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
        {permitDefs.map((permit, i) => {
          const Icon = getPermitIcon(permit.name);
          const watch = getWatchState(permit.name);
          const isActive = watch?.is_active ?? false;
          const isLoading = loadingId === permit.name;
          const seasonLabel = permit.season_start && permit.season_end
            ? `${permit.season_start} – ${permit.season_end}`
            : "";

          return (
            <motion.div
              key={permit.name}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl p-4 border transition-colors ${
                isActive
                  ? "bg-secondary/10 border-secondary/30"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
                }`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[13px] text-foreground">{permit.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{permit.description || seasonLabel}</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => toggleWatch(permit.name)}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-secondary"
                />
              </div>

              {/* Status row */}
              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border/50">
                <AnimatePresence mode="wait">
                  {isActive ? (
                    <motion.div key="live" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                      </span>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Monitoring…</span>
                    </motion.div>
                  ) : (
                    <motion.span key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Inactive
                    </motion.span>
                  )}
                </AnimatePresence>
                {watch && isActive ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">SMS</span>
                    {!hasPhone && (
                      <button
                        onClick={() => setShowPhoneInput(showPhoneInput === watch.id ? null : watch.id)}
                        className="text-[9px] text-secondary font-semibold flex items-center gap-0.5 hover:underline"
                      >
                        <Phone size={8} />
                        Add phone
                      </button>
                    )}
                    <Switch
                      checked={watch.notify_sms}
                      onCheckedChange={() => {
                        if (!hasPhone) {
                          setShowPhoneInput(watch.id);
                          return;
                        }
                        toggleNotify(watch.id);
                      }}
                      className="data-[state=checked]:bg-secondary"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">SMS</span>
                    <Switch checked={false} disabled className="opacity-40" />
                  </div>
                )}
              </div>

              {/* Inline phone input */}
              <AnimatePresence>
                {watch && isActive && !hasPhone && showPhoneInput === watch.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d+\-() ]/g, ""))}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
                          maxLength={20}
                        />
                      </div>
                      <button
                        disabled={phoneInput.replace(/\D/g, "").length < 10 || savingPhone}
                        onClick={async () => {
                          if (!user) return;
                          setSavingPhone(true);
                          try {
                            await supabase
                              .from("profiles")
                              .update({ phone_number: phoneInput })
                              .eq("user_id", user.id);
                            setHasPhone(true);
                            setShowPhoneInput(null);
                            // Auto-enable SMS for this watch
                            await supabase
                              .from("active_watches")
                              .update({ notify_sms: true })
                              .eq("id", watch.id);
                            setWatches((prev) => prev.map((w) => w.id === watch.id ? { ...w, notify_sms: true } : w));
                            toast({ title: "📱 SMS alerts activated", description: "You'll get a text when this permit opens." });
                          } finally {
                            setSavingPhone(false);
                          }
                        }}
                        className="shrink-0 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                      >
                        {savingPhone ? "…" : "Save"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">US numbers only. We'll auto-enable SMS for this watch.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {/* Test Notification */}
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
