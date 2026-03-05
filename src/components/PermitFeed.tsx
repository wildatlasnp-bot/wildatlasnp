import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Radio, Activity } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { formatDistanceToNow, format, parseISO } from "date-fns";

interface Find {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
  available_dates?: string[];
}

type Tab = "finds" | "activity";

interface PermitFeedProps {
  parkId?: string;
}

const PermitFeed = ({ parkId }: PermitFeedProps) => {
  const [tab, setTab] = useState<Tab>("finds");
  const [finds, setFinds] = useState<Find[]>([]);
  const [activity, setActivity] = useState<Find[]>([]);
  const [loadingFinds, setLoadingFinds] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [filterParkFinds, setFilterParkFinds] = useState(true);
  const [filterParkActivity, setFilterParkActivity] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchFinds = useCallback(async () => {
    let query = supabase.from("recent_finds").select("id, park_id, permit_name, found_at, available_dates").order("found_at", { ascending: false }).limit(10);
    if (filterParkFinds && parkId) query = query.eq("park_id", parkId);
    const { data } = await query;
    if (!mountedRef.current) return;
    setFinds((data ?? []) as Find[]);
    setLoadingFinds(false);
  }, [filterParkFinds, parkId]);

  const fetchActivity = useCallback(async () => {
    let query = supabase.from("recent_finds").select("id, park_id, permit_name, found_at").order("found_at", { ascending: false }).limit(5);
    if (filterParkActivity && parkId) query = query.eq("park_id", parkId);
    const { data } = await query;
    if (!mountedRef.current) return;
    setActivity((data ?? []) as Find[]);
    setLoadingActivity(false);
  }, [filterParkActivity, parkId]);

  useEffect(() => { fetchFinds(); }, [fetchFinds]);
  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    const channel = supabase
      .channel("permit-feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recent_finds" }, (payload) => {
        if (!mountedRef.current) return;
        const newFind = payload.new as Find;
        if (!filterParkFinds || !parkId || newFind.park_id === parkId) setFinds((prev) => [newFind, ...prev].slice(0, 10));
        if (!filterParkActivity || !parkId || newFind.park_id === parkId) setActivity((prev) => [newFind, ...prev].slice(0, 5));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [parkId, filterParkFinds, filterParkActivity]);

  const currentParkName = parkId ? PARKS[parkId]?.shortName ?? parkId : "All Parks";
  const isFindsTab = tab === "finds";
  const filterPark = isFindsTab ? filterParkFinds : filterParkActivity;
  const toggleFilter = isFindsTab ? () => setFilterParkFinds((p) => !p) : () => setFilterParkActivity((p) => !p);

  return (
    <div className="px-5 mb-4">
      {/* Tab header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setTab("finds")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
              isFindsTab ? "bg-background text-secondary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={10} />
            Finds
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
              !isFindsTab ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity size={10} />
            Activity
          </button>
        </div>
        <button
          onClick={toggleFilter}
          className="text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          {filterPark ? currentParkName : "All parks"}
        </button>
      </div>

      {/* Finds tab — timeline style */}
      {isFindsTab && (
        <>
          {loadingFinds ? (
            <div className="flex items-center gap-2 py-3">
              <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
              <span className="text-[11px] text-muted-foreground">Loading finds…</span>
            </div>
          ) : finds.length === 0 ? (
            <div className="flex items-center gap-2.5 py-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
              </span>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-foreground">Scanning for permits…</p>
                <p className="text-[10px] text-muted-foreground">No openings detected yet.</p>
              </div>
            </div>
          ) : (
            <div className="relative max-h-[200px] overflow-y-auto">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-0.5">
                <AnimatePresence mode="popLayout">
                  {finds.map((f, i) => {
                    const parkName = PARKS[f.park_id]?.shortName ?? f.park_id;
                    const dates = (f.available_dates ?? []).slice(0, 3);
                    return (
                      <motion.div
                        key={f.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="relative flex items-start gap-3 py-2 pl-1"
                      >
                        {/* Timeline dot */}
                        <div className="relative z-10 mt-1.5 w-3.5 h-3.5 rounded-full bg-status-found/15 border-2 border-status-found flex items-center justify-center shrink-0">
                          <div className="w-1 h-1 rounded-full bg-status-found" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[11px] font-semibold text-foreground truncate">{f.permit_name}</span>
                            {!filterParkFinds && (
                              <span className="text-[9px] text-muted-foreground shrink-0">· {parkName}</span>
                            )}
                          </div>
                          <span className="text-[9px] text-muted-foreground">
                            {formatDistanceToNow(new Date(f.found_at), { addSuffix: true })}
                          </span>
                          {dates.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {dates.map((d) => (
                                <span key={d} className="text-[8px] font-semibold text-status-found bg-status-found/10 rounded px-1.5 py-0.5">
                                  {format(parseISO(d), "MMM d")}
                                </span>
                              ))}
                              {(f.available_dates ?? []).length > 3 && (
                                <span className="text-[8px] text-muted-foreground">+{f.available_dates!.length - 3}</span>
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

          {!loadingFinds && finds.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <Radio size={9} className="text-status-scanning animate-pulse" />
              <span className="text-[9px] text-muted-foreground font-medium">Monitoring for cancellations</span>
            </div>
          )}
        </>
      )}

      {/* Activity tab */}
      {!isFindsTab && (
        <>
          {loadingActivity ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
              <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
              <span className="text-[11px] text-muted-foreground">Loading activity…</span>
            </div>
          ) : activity.length === 0 ? (
            <div className="rounded-xl bg-muted/20 border border-border px-4 py-3">
              <p className="text-[11px] text-muted-foreground">No recent permit activity detected.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-0.5">
                <AnimatePresence mode="popLayout">
                  {activity.map((item, i) => {
                    const parkName = PARKS[item.park_id]?.shortName ?? item.park_id;
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="relative flex items-start gap-3 py-2 pl-1"
                      >
                        <div className="relative z-10 mt-1.5 w-3.5 h-3.5 rounded-full bg-muted border-2 border-muted-foreground/20 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">
                            {parkName} — {item.permit_name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.found_at), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PermitFeed;
