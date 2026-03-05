import { Eye, Bell, Zap } from "lucide-react";
import type { Watch } from "@/components/WatchCard";
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
      value: isPro ? String(activeCount) : activeCount > 0 ? `${activeCount}/${FREE_WATCH_LIMIT}` : "0 active",
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
        {!isPro && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Free plan — track up to {FREE_WATCH_LIMIT} permit. <button onClick={onUpgrade} className="text-secondary font-semibold hover:underline">Upgrade for unlimited</button>
          </p>
        )}
      </div>

    </>
  );
};

export default SniperStats;
