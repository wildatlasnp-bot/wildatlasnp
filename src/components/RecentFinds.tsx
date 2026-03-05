import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Search, Radio } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { formatDistanceToNow, format, parseISO } from "date-fns";

interface Find {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
  available_dates: string[];
}

interface RecentFindsProps {
  parkId?: string;
}

const RecentFinds = ({ parkId }: RecentFindsProps) => {
  const [finds, setFinds] = useState<Find[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPark, setFilterPark] = useState(true);

  const fetchFinds = useCallback(async () => {
    let query = supabase
      .from("recent_finds")
      .select("*")
      .order("found_at", { ascending: false })
      .limit(15);

    if (filterPark && parkId) {
      query = query.eq("park_id", parkId);
    }

    const { data } = await query;
    if (data) setFinds(data as Find[]);
    setLoading(false);
  }, [parkId, filterPark]);

  // Initial fetch + refetch on filter/park change
  useEffect(() => {
    fetchFinds();
  }, [fetchFinds]);

  // Realtime subscription for new inserts
  useEffect(() => {
    const channel = supabase
      .channel("recent-finds-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recent_finds" },
        (payload) => {
          const newFind = payload.new as Find;
          // If filtering by park, skip finds from other parks
          if (filterPark && parkId && newFind.park_id !== parkId) return;
          setFinds((prev) => [newFind, ...prev].slice(0, 15));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parkId, filterPark]);

  const todayCount = finds.filter((f) => {
    const d = new Date(f.found_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const currentParkName = parkId ? PARKS[parkId]?.shortName ?? parkId : "All Parks";

  return (
    <div className="px-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-secondary" />
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
            Recent Finds
          </span>
          {todayCount > 0 && (
            <span className="text-[9px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 ml-1">
              {todayCount} today
            </span>
          )}
        </div>
        <button
          onClick={() => setFilterPark((p) => !p)}
          className="text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          {filterPark ? "All parks" : currentParkName}
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading finds…</span>
        </div>
      ) : finds.length === 0 ? (
        /* Empty state */
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/20 border border-border px-4 py-3.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <div className="flex-1">
            <p className="text-[11px] font-medium text-foreground">Scanner active</p>
            <p className="text-[10px] text-muted-foreground">
              Scanning Recreation.gov for new permit availability...
            </p>
          </div>
          <Search size={13} className="text-muted-foreground/40 shrink-0" />
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {finds.map((f, i) => {
              const parkName = PARKS[f.park_id]?.shortName ?? f.park_id;
              const dates = (f.available_dates ?? []).slice(0, 3);
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, x: -10, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 30 }}
                  className="rounded-lg bg-secondary/5 border border-secondary/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                    </span>
                    <span className="text-[11px] text-foreground font-medium truncate flex-1">
                      {f.permit_name}
                    </span>
                    {!filterPark && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{parkName}</span>
                    )}
                    <span className="text-[9px] text-muted-foreground/60 shrink-0">
                      {formatDistanceToNow(new Date(f.found_at), { addSuffix: true })}
                    </span>
                  </div>
                  {dates.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 ml-3.5">
                      {dates.map((d) => (
                        <span
                          key={d}
                          className="text-[9px] font-medium text-secondary bg-secondary/10 rounded px-1.5 py-0.5"
                        >
                          {format(parseISO(d), "MMM d")}
                        </span>
                      ))}
                      {(f.available_dates ?? []).length > 3 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{f.available_dates.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Scanner-active footer when finds exist */}
      {!loading && finds.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 px-1">
          <Radio size={9} className="text-primary animate-pulse" />
          <span className="text-[9px] text-muted-foreground">
            Scanner active · monitoring for cancellations
          </span>
        </div>
      )}
    </div>
  );
};

export default RecentFinds;
