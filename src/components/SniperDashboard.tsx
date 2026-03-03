import { ShieldCheck, Mountain, Trees, Tent } from "lucide-react";
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
    setWatches((prev) =>
      prev.map((w) => (w.id === id ? { ...w, notify: !w.notify } : w))
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Sniper</h1>
        <p className="text-sm text-muted-foreground">Permit watch & notifications</p>
      </div>

      {/* Stats row */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Watching", value: String(watches.length), color: "bg-primary/10 text-primary" },
          { label: "Alerts On", value: String(watches.filter((w) => w.notify).length), color: "bg-secondary/10 text-secondary" },
          { label: "Found", value: "0", color: "bg-muted text-muted-foreground" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-3 text-center ${stat.color}`}>
            <div className="text-2xl font-heading font-bold">{stat.value}</div>
            <div className="text-xs font-medium mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Section title */}
      <div className="px-4 mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Watches</h2>
      </div>

      {/* Watch cards */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {watches.map((watch, i) => {
          const Icon = watch.icon;
          return (
            <motion.div
              key={watch.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground">{watch.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{watch.dates}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                  <span className="text-xs font-medium text-secondary">{watch.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Notify Me</span>
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
