import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import type { Watch, PermitDef } from "@/components/WatchCard";
import type { PermitAvailability } from "@/hooks/useSniperData";
import { scrollToCard } from "@/lib/scrollToCard";

interface SniperStatsProps {
  isPro: boolean;
  FREE_WATCH_LIMIT: number;
  activeCount: number;
  alertCount: number;
  foundCount: number;
  totalAvailDates: number;
  permitDefs: PermitDef[];
  watches: Watch[];
  getAvailability: (permitName: string) => PermitAvailability[];
  onUpgrade: () => void;
}

const SniperStats = ({
  isPro, FREE_WATCH_LIMIT, activeCount, alertCount, foundCount, totalAvailDates,
  permitDefs, watches, getAvailability, onUpgrade,
}: SniperStatsProps) => {
  const stats = [
    {
      label: "Watching",
      value: isPro ? String(activeCount) : `${activeCount}/${FREE_WATCH_LIMIT}`,
      cls: "text-primary",
      action: undefined,
    },
    {
      label: "Available",
      value: String(totalAvailDates),
      cls: totalAvailDates > 0 ? "text-status-found" : "text-muted-foreground",
      action: totalAvailDates > 0 ? () => {
        const firstAvail = permitDefs.find((p) => getAvailability(p.name).length > 0);
        if (firstAvail) scrollToCard(firstAvail.name);
      } : undefined,
    },
    {
      label: "Alerts",
      value: String(alertCount),
      cls: alertCount > 0 ? "text-status-quiet" : "text-muted-foreground",
      action: undefined,
    },
    {
      label: "Found",
      value: foundCount > 0 ? String(foundCount) : "–",
      cls: foundCount > 0 ? "text-status-found" : "text-muted-foreground",
      highlight: foundCount > 0,
      action: foundCount > 0 ? () => {
        const firstFound = watches.find((w) => w.status === "found");
        if (firstFound) scrollToCard(firstFound.permit_name);
      } : undefined,
    },
  ];

  return (
    <>
      {/* Horizontal stat bar */}
      <div className="px-5 mt-2 mb-3">
        <div className="flex items-stretch gap-0 bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              onClick={s.action}
              className={`flex-1 py-2.5 text-center ${s.action ? "cursor-pointer active:bg-muted/50 transition-colors" : ""} ${
                i < stats.length - 1 ? "border-r border-border" : ""
              } ${s.highlight ? "bg-status-found/5" : ""}`}
            >
              <div className={`font-body font-bold text-lg leading-none ${s.cls}`}>{s.value}</div>
              <div className="font-body font-medium text-[8px] text-muted-foreground uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade prompt — minimal inline banner */}
      {!isPro && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onUpgrade}
          className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        >
          <Lock size={11} className="text-secondary shrink-0" />
          <span className="text-[10px] text-muted-foreground flex-1">
            Free plan · {FREE_WATCH_LIMIT} watch, email only
          </span>
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider shrink-0">Upgrade</span>
        </motion.button>
      )}
    </>
  );
};

export default SniperStats;
