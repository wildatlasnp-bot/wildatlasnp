import { motion, AnimatePresence } from "framer-motion";
import { Zap, Radio } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import type { RecentFindsData } from "@/hooks/useRecentFinds";

interface PermitFeedProps {
  recentFinds: RecentFindsData;
}

const PermitFeed = ({ recentFinds }: PermitFeedProps) => {
  const { finds, loading } = recentFinds;

  return (
    <div className="px-5 mb-5">
      <div className="flex items-center gap-1.5 mb-3">
        <Zap size={11} className="text-secondary" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-secondary">Recent Finds</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[12px] text-muted-foreground">Loading finds…</span>
        </div>
      ) : finds.length === 0 ? (
        <div className="flex items-center gap-2.5 py-4">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-scanning" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-foreground">Scanning for permits…</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">No openings detected yet.</p>
          </div>
        </div>
      ) : (
        <div className="relative max-h-[260px] overflow-y-auto">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {finds.map((f, i) => {
                const dates = (f.available_dates ?? []).slice(0, 3);
                return (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="relative flex items-start gap-4 py-3.5 pl-1"
                  >
                    <div className="relative z-10 mt-1.5 w-3.5 h-3.5 rounded-full bg-status-found/15 border-2 border-status-found flex items-center justify-center shrink-0">
                      <div className="w-1 h-1 rounded-full bg-status-found" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-bold text-foreground truncate block">{f.permit_name}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {f.location_name && (
                          <span className="text-[11px] text-muted-foreground">{f.location_name}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground/50">
                          {f.location_name ? "· " : ""}{formatDistanceToNow(new Date(f.found_at), { addSuffix: true })}
                        </span>
                      </div>
                      {dates.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          {dates.map((d) => (
                            <span key={d} className="text-[10px] font-bold text-status-found bg-status-found/10 rounded px-1.5 py-0.5">
                              {format(parseISO(d), "MMM d")}
                            </span>
                          ))}
                          {(f.available_dates ?? []).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{f.available_dates!.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {!loading && finds.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 px-1">
          <Radio size={9} className="text-status-scanning animate-pulse" />
          <span className="text-[10px] text-muted-foreground/60 font-medium">Monitoring for cancellations</span>
        </div>
      )}
    </div>
  );
};

export default PermitFeed;