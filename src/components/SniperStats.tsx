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
    { label: "Watching", value: isPro ? String(activeCount) : `${activeCount}/${FREE_WATCH_LIMIT}`, cls: "bg-primary/10 text-primary", action: undefined },
    { label: "Available", value: String(totalAvailDates), cls: totalAvailDates > 0 ? "bg-status-found/12 text-status-found" : "bg-muted text-muted-foreground", action: totalAvailDates > 0 ? () => {
      const firstAvail = permitDefs.find((p) => getAvailability(p.name).length > 0);
      if (firstAvail) scrollToCard(firstAvail.name);
    } : undefined },
    { label: "Alerts On", value: String(alertCount), cls: alertCount > 0 ? "bg-status-quiet/12 text-status-quiet" : "bg-muted text-muted-foreground", action: undefined },
    { label: foundCount > 0 ? "Found" : "Scanning", value: foundCount > 0 ? String(foundCount) : "…", cls: foundCount > 0 ? "bg-status-found/12 text-status-found font-bold" : "bg-status-scanning/8 text-status-scanning", action: foundCount > 0 ? () => {
      const firstFound = watches.find((w) => w.status === "found");
      if (firstFound) scrollToCard(firstFound.permit_name);
    } : undefined },
  ];

  return (
    <>
      <div className="px-5 mt-4 grid grid-cols-4 gap-2.5 mb-4">
        {stats.map((s) => (
          <div
            key={s.label}
            onClick={s.action}
            className={`rounded-xl p-3 text-center ${s.cls} ${s.action ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
          >
            <div className={`font-body font-bold ${s.value === "Scanning…" ? "text-[10px] leading-tight" : "text-xl"}`}>{s.value}</div>
            <div className={`font-body font-medium mt-0.5 uppercase tracking-wider ${s.value === "Scanning…" ? "text-[8px] opacity-70" : "text-[9px]"}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {!isPro && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onUpgrade}
          className="mx-5 mb-4 flex items-center gap-2.5 rounded-xl border border-secondary/30 bg-secondary/5 px-4 py-3 text-left hover:bg-secondary/10 transition-colors"
        >
          <Lock size={14} className="text-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-foreground">Free Plan</span>
            <span className="text-[11px] text-muted-foreground ml-1.5">· {FREE_WATCH_LIMIT} watch, email only</span>
          </div>
          <span className="text-[11px] font-bold text-secondary uppercase tracking-wider shrink-0">Upgrade</span>
        </motion.button>
      )}
    </>
  );
};

export default SniperStats;
