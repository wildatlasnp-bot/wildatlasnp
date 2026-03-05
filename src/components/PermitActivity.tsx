import { Activity, Clock, TrendingUp } from "lucide-react";
import type { RecentFindsData } from "@/hooks/useRecentFinds";

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
};

const PermitActivity = ({ recentFinds }: { recentFinds: RecentFindsData }) => {
  if (recentFinds.loading) return null;

  const stats = [
    {
      icon: Activity,
      value: String(recentFinds.todayCount),
      label: "Detected Today",
      cls: recentFinds.todayCount > 0 ? "text-status-found" : "text-muted-foreground",
    },
    {
      icon: Clock,
      value: recentFinds.lastFound ? formatTimeAgo(recentFinds.lastFound) : "–",
      label: "Last Opening",
      cls: recentFinds.lastFound ? "text-primary" : "text-muted-foreground",
    },
    {
      icon: TrendingUp,
      value: recentFinds.topPermit ?? "–",
      label: "Most Active",
      cls: recentFinds.topPermit ? "text-secondary" : "text-muted-foreground",
      small: true,
    },
  ];

  return (
    <div className="px-5 mb-3">
      <p className="section-header mb-2.5">Permit Activity</p>
      <div className="flex items-stretch gap-0 rounded-lg border border-border bg-card/50">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex-1 py-4 text-center ${i < stats.length - 1 ? "border-r border-border" : ""}`}
            >
              <Icon size={13} className={`mx-auto mb-1.5 ${s.cls}`} />
              <div className={`font-body font-extrabold leading-none ${s.cls} ${s.small ? "text-[12px]" : "text-xl"}`}>
                {s.value}
              </div>
              <div className="font-body font-semibold text-[8px] text-foreground/50 uppercase tracking-widest mt-2">
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PermitActivity;
