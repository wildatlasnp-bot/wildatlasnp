import { useState } from "react";
import { Zap, Radio } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import type { RecentFindsData } from "@/hooks/useRecentFinds";

interface PermitFeedProps {
  recentFinds: RecentFindsData;
}

const VISIBLE_COUNT = 3;

function detectedAgo(foundAt: string): string {
  const dist = formatDistanceToNow(parseISO(foundAt), { addSuffix: false });
  // "less than a minute" → "just now", otherwise "Found Xh ago"
  if (dist.includes("less than")) return "Detected just now";
  return `Detected ${dist} ago`;
}

const PermitFeed = ({ recentFinds }: PermitFeedProps) => {
  const { finds, loading } = recentFinds;
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? finds : finds.slice(0, VISIBLE_COUNT);
  const hasMore = finds.length > VISIBLE_COUNT;

  return (
    <div className="px-5 mb-5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Zap size={10} className="text-secondary" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-secondary">Recent Permit Openings</span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mb-2.5 ml-[18px]">
        Past cancellations & released inventory detected by the scanner.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
          <span className="text-[12px] text-muted-foreground">Loading…</span>
        </div>
      ) : finds.length === 0 ? (
        <div className="flex items-center gap-2 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-status-scanning status-dot-pulse" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
          </span>
          <p className="text-[12px] text-muted-foreground">Scanning — no openings detected yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {visible.map((f) => {
              const dates = (f.available_dates ?? []).slice(0, 4);
              const olderDates = dates.slice(1);
              return (
                <div key={f.id} className="py-2.5 border-b border-border/30 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-bold text-foreground truncate block leading-snug">{f.permit_name}</span>
                      {f.location_name && (
                        <span className="text-[11px] text-muted-foreground">{f.location_name}</span>
                      )}
                    </div>
                    {dates.length > 0 && (
                      <span className="text-[10px] font-semibold text-status-found bg-status-found/10 rounded px-1.5 py-0.5 shrink-0 ml-3">
                        Trip Date: {format(parseISO(dates[0]), "MMM d")}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5 block">
                    {detectedAgo(f.found_at)}
                  </span>
                  {olderDates.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] text-muted-foreground/50 mr-0.5">Previous:</span>
                      {olderDates.map((d) => (
                        <span key={d} className="text-[9px] text-muted-foreground/60 font-medium">
                          {format(parseISO(d), "MMM d")}
                        </span>
                      ))}
                      {(f.available_dates ?? []).length > 4 && (
                        <span className="text-[9px] text-muted-foreground/40">+{f.available_dates!.length - 4}</span>
                      )}
                    </div>
                  )}
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
