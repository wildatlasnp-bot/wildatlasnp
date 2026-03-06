import { useState } from "react";
import { Zap, Radio } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { RecentFindsData } from "@/hooks/useRecentFinds";

interface PermitFeedProps {
  recentFinds: RecentFindsData;
}

const VISIBLE_COUNT = 3;

const PermitFeed = ({ recentFinds }: PermitFeedProps) => {
  const { finds, loading } = recentFinds;
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? finds : finds.slice(0, VISIBLE_COUNT);
  const hasMore = finds.length > VISIBLE_COUNT;

  return (
    <div className="px-5 mb-5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap size={10} className="text-secondary" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-secondary">Recent Permit Openings</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
          <span className="text-[12px] text-muted-foreground">Loading…</span>
        </div>
      ) : finds.length === 0 ? (
        <div className="flex items-center gap-2 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
          </span>
          <p className="text-[12px] text-muted-foreground">Scanning — no openings detected yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {visible.map((f) => {
              const dates = (f.available_dates ?? []).slice(0, 4);
              return (
                <div key={f.id} className="flex items-baseline justify-between py-2 border-b border-border/30 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-foreground truncate block leading-snug">{f.permit_name}</span>
                    {f.location_name && (
                      <span className="text-[11px] text-muted-foreground">{f.location_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {dates.map((d) => (
                      <span key={d} className="text-[10px] font-semibold text-status-found bg-status-found/10 rounded px-1.5 py-0.5">
                        {format(parseISO(d), "MMM d")}
                      </span>
                    ))}
                    {(f.available_dates ?? []).length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{f.available_dates!.length - 4}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold text-secondary hover:underline mt-2"
            >
              {expanded ? "Show less" : `View ${finds.length - VISIBLE_COUNT} more`}
            </button>
          )}

          <div className="flex items-center gap-1.5 mt-2">
            <Radio size={8} className="text-status-scanning animate-pulse" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">Monitoring for cancellations</span>
          </div>
        </>
      )}
    </div>
  );
};

export default PermitFeed;
