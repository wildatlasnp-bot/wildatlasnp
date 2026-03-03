import { ShieldCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface Permit {
  id: number;
  name: string;
  date: string;
  status: "confirmed" | "pending" | "expired";
}

const permits: Permit[] = [
  { id: 1, name: "Half Dome Day Hike", date: "Mar 15, 2026", status: "confirmed" },
  { id: 2, name: "Wilderness Overnight — LYV", date: "Mar 22, 2026", status: "pending" },
  { id: 3, name: "Yosemite Falls Trail", date: "Feb 10, 2026", status: "expired" },
];

const statusConfig = {
  confirmed: { icon: CheckCircle2, label: "Confirmed", className: "text-primary bg-primary/10" },
  pending: { icon: Clock, label: "Pending", className: "text-secondary bg-secondary/10" },
  expired: { icon: AlertCircle, label: "Expired", className: "text-muted-foreground bg-muted" },
};

const SniperDashboard = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Sniper</h1>
        <p className="text-sm text-muted-foreground">Permit dashboard & tracker</p>
      </div>

      {/* Stats row */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Active", value: "1", color: "bg-primary/10 text-primary" },
          { label: "Pending", value: "1", color: "bg-secondary/10 text-secondary" },
          { label: "Total", value: "3", color: "bg-muted text-muted-foreground" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl p-3 text-center ${stat.color}`}
          >
            <div className="text-2xl font-heading font-bold">{stat.value}</div>
            <div className="text-xs font-medium mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Permit list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {permits.map((permit, i) => {
          const cfg = statusConfig[permit.status];
          const StatusIcon = cfg.icon;
          return (
            <motion.div
              key={permit.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.className}`}>
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">
                  {permit.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{permit.date}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.className}`}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SniperDashboard;
