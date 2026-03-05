import { Lock, Eye, Bell, Zap, Check, ArrowRight } from "lucide-react";
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
  isPro, FREE_WATCH_LIMIT, activeCount, alertCount, foundCount,
  watches, onUpgrade,
}: SniperStatsProps) => {
  const stats = [
    {
      label: "Tracking",
      value: isPro ? String(activeCount) : `${activeCount}/${FREE_WATCH_LIMIT}`,
      icon: Eye,
      cls: "text-primary",
      action: undefined as (() => void) | undefined,
    },
    {
      label: "Alerts On",
      value: String(alertCount),
      icon: Bell,
      cls: alertCount > 0 ? "text-status-quiet" : "text-muted-foreground",
      action: undefined as (() => void) | undefined,
    },
    {
      label: "Found",
      value: foundCount > 0 ? String(foundCount) : "–",
      icon: Zap,
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
      {/* Large stat row */}
      <div className="px-5 mt-1 mb-4">
        <div className="flex items-stretch gap-0">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                onClick={s.action}
                className={`flex-1 py-3 text-center ${s.action ? "cursor-pointer active:bg-muted/50 transition-colors" : ""} ${
                  i < stats.length - 1 ? "border-r border-border" : ""
                } ${s.highlight ? "bg-status-found/5" : ""}`}
              >
                <Icon size={14} className={`mx-auto mb-1 ${s.cls}`} />
                <div className={`font-body font-bold text-xl leading-none ${s.cls}`}>{s.value}</div>
                <div className="font-body font-medium text-[8px] text-muted-foreground uppercase tracking-widest mt-1.5">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade prompt — inline comparison */}
      {!isPro && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-4 rounded-xl border border-secondary/20 bg-secondary/5 p-4"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Free column */}
            <div>
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Free</p>
              <div className="space-y-1.5">
                {[`${FREE_WATCH_LIMIT} permit tracker`, "Email alerts"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Check size={10} className="text-muted-foreground/60 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Pro column */}
            <div>
              <p className="text-[9px] font-bold text-secondary uppercase tracking-wider mb-2">Pro</p>
              <div className="space-y-1.5">
                {["Unlimited watches", "SMS alerts", "Priority scanning", "Faster notifications"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Check size={10} className="text-secondary shrink-0" />
                    <span className="text-[11px] text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-foreground/80 text-center mb-3 font-medium">
            Pro users receive alerts faster when permits become available.
          </p>

          <button
            onClick={onUpgrade}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <ArrowRight size={14} />
            Upgrade to Pro — $9.99/mo
          </button>
        </motion.div>
      )}
    </>
  );
};

export default SniperStats;
