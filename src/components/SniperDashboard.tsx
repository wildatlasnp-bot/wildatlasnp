import { Mountain, Tent, Trees, Plus, Lock, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Watch {
  id: string;
  permit_name: string;
  status: string;
  is_active: boolean;
  notify_sms: boolean;
}

const permitDefaults = [
  { permit_name: "Half Dome Cables", icon: Mountain, dates: "Jun 1 – Oct 15, 2026" },
  { permit_name: "Upper Pines Campground", icon: Tent, dates: "Apr – Sep 2026" },
  { permit_name: "Yosemite Wilderness", icon: Trees, dates: "May – Nov 2026" },
];

const iconMap: Record<string, React.ElementType> = {
  "Half Dome Cables": Mountain,
  "Upper Pines Campground": Tent,
  "Yosemite Wilderness": Trees,
};

const dateMap: Record<string, string> = {
  "Half Dome Cables": "Jun 1 – Oct 15, 2026",
  "Upper Pines Campground": "Apr – Sep 2026",
  "Yosemite Wilderness": "May – Nov 2026",
};

const SniperDashboard = () => {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load watches from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("active_watches")
        .select("*")
        .eq("user_id", user.id);
      if (data) setWatches(data);
    };
    load();
  }, [user]);

  const activateWatch = async (permitName: string) => {
    if (!user) return;
    setLoadingId(permitName);

    // Check if already exists
    const existing = watches.find((w) => w.permit_name === permitName);
    if (existing) {
      const { error } = await supabase
        .from("active_watches")
        .update({ is_active: true, status: "live" })
        .eq("id", existing.id);
      if (!error) {
        setWatches((prev) => prev.map((w) => w.id === existing.id ? { ...w, is_active: true, status: "live" } : w));
      }
    } else {
      const { data, error } = await supabase
        .from("active_watches")
        .insert({ user_id: user.id, permit_name: permitName, status: "live", is_active: true, notify_sms: false })
        .select()
        .single();
      if (!error && data) {
        setWatches((prev) => [...prev, data]);
      }
    }

    setLoadingId(null);
    toast({
      title: "🎯 Watch activated",
      description: "Pathfinder is now scanning Recreation.gov every 60 seconds for you.",
    });
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-medium text-secondary tracking-widest uppercase mb-1">Permit Sniper</p>
        <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">Active Watches</h1>
        <p className="text-sm text-muted-foreground mt-1">We'll ping you when a slot opens.</p>
      </div>

      {/* Stats */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Watching", value: String(activeCount), cls: "bg-primary/8 text-primary" },
          { label: "Alerts On", value: String(alertCount), cls: "bg-secondary/10 text-secondary" },
          { label: "Found", value: "0", cls: "bg-muted text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3.5 text-center ${s.cls}`}>
            <div className="text-xl font-heading font-bold">{s.value}</div>
            <div className="text-[10px] font-medium mt-0.5 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-6">
        {permitDefaults.map((permit, i) => {
          const Icon = permit.icon;
          const watch = getWatchState(permit.permit_name);
          const isActive = watch?.is_active ?? false;
          const isLoading = loadingId === permit.permit_name;

          return (
            <motion.div
              key={permit.permit_name}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[13px] text-foreground">{permit.permit_name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{permit.dates}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border">
                <AnimatePresence mode="wait">
                  {isActive ? (
                    <motion.div key="live" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                      </span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider animate-pulse-soft">Live Monitoring</span>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="add"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => activateWatch(permit.permit_name)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      {isLoading ? "Activating…" : "Add a Watch"}
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">SMS Alerts</span>
                    <Lock size={10} className="text-muted-foreground/60" />
                    <span className="text-[8px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Pro</span>
                  </div>
                  <Switch checked={watch?.notify_sms ?? false} onCheckedChange={() => watch && toggleNotify(watch.id)} disabled={!isActive} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SniperDashboard;
