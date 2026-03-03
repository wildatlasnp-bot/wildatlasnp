import { Mountain, Tent, Trees } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

interface Watch {
  id: number;
  name: string;
  icon: React.ElementType;
  dates: string;
  status: string;
  notify: boolean;
}

const initialWatches: Watch[] = [
  { id: 1, name: "Half Dome Cables", icon: Mountain, dates: "Jun 1 – Oct 15, 2026", status: "Searching…", notify: true },
  { id: 2, name: "Upper Pines Campground", icon: Tent, dates: "Apr – Sep 2026", status: "Searching…", notify: true },
  { id: 3, name: "Yosemite Wilderness", icon: Trees, dates: "May – Nov 2026", status: "Searching…", notify: false },
];

const SniperDashboard = () => {
  const [watches, setWatches] = useState(initialWatches);

  const toggleNotify = (id: number) => {
    setWatches((prev) => prev.map((w) => (w.id === id ? { ...w, notify: !w.notify } : w)));
  };

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
          { label: "Watching", value: String(watches.length), cls: "bg-primary/8 text-primary" },
          { label: "Alerts On", value: String(watches.filter((w) => w.notify).length), cls: "bg-secondary/10 text-secondary" },
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
        {watches.map((watch, i) => {
          const Icon = watch.icon;
          return (
            <motion.div
              key={watch.id}
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
                  <h3 className="font-semibold text-[13px] text-foreground">{watch.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{watch.dates}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                  </span>
                  <span className="text-[11px] font-medium text-secondary">{watch.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Notify Me</span>
                  <Switch checked={watch.notify} onCheckedChange={() => toggleNotify(watch.id)} />
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
