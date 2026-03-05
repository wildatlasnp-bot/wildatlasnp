import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Search, Radio, Activity } from "lucide-react";
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch Recent Finds
  const fetchFinds = useCallback(async () => {
    let query = supabase
      .from("recent_finds")
      .select("id, park_id, permit_name, found_at, available_dates")
      .order("found_at", { ascending: false })
      .limit(10);

    if (filterParkFinds && parkId) {
      query = query.eq("park_id", parkId);
    }

    const { data } = await query;
    if (!mountedRef.current) return;
    setFinds((data ?? []) as Find[]);
    setLoadingFinds(false);
  }, [filterParkFinds, parkId]);

  // Fetch Live Activity
  const fetchActivity = useCallback(async () => {
    let query = supabase
      .from("recent_finds")
      .select("id, park_id, permit_name, found_at")
      .order("found_at", { ascending: false })
      .limit(5);

    if (filterParkActivity && parkId) {
      query = query.eq("park_id", parkId);
    }

    const { data } = await query;
    if (!mountedRef.current) return;
    setActivity((data ?? []) as Find[]);
    setLoadingActivity(false);
  }, [filterParkActivity, parkId]);

  useEffect(() => { fetchFinds(); }, [fetchFinds]);
  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Realtime for both tabs
  useEffect(() => {
    const channel = supabase
      .channel("permit-feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recent_finds" },
        (payload) => {
          if (!mountedRef.current) return;
          const newFind = payload.new as Find;

          // Update finds
          if (!filterParkFinds || !parkId || newFind.park_id === parkId) {
            setFinds((prev) => [newFind, ...prev].slice(0, 10));
          }

          // Update activity
          if (!filterParkActivity || !parkId || newFind.park_id === parkId) {
            setActivity((prev) => [newFind, ...prev].slice(0, 5));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [parkId, filterParkFinds, filterParkActivity]);

  const todayCount = finds.filter((f) => {
    const d = new Date(f.found_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const currentParkName = parkId ? PARKS[parkId]?.shortName ?? parkId : "All Parks";

  const isFindsTab = tab === "finds";
  const filterPark = isFindsTab ? filterParkFinds : filterParkActivity;
  const toggleFilter = isFindsTab
    ? () => setFilterParkFinds((p) => !p)
    : () => setFilterParkActivity((p) => !p);

  return (
    <div className="px-5 mb-4">
      {/* Tab header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setTab("finds")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
              isFindsTab
                ? "bg-background text-secondary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={10} />
            Finds
            {isFindsTab && todayCount > 0 && (
              <span className="text-[9px] font-semibold bg-muted rounded-full px-1.5 py-0.5 ml-0.5">
                {todayCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
              !isFindsTab
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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

      {/* Finds tab */}
      {isFindsTab && (
        <>
          {loadingFinds ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
              <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
              <span className="text-[11px] text-muted-foreground">Loading finds…</span>
            </div>
          ) : finds.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-status-scanning/5 border border-status-scanning/15 px-4 py-3.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
              </span>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-foreground">Scanner active</p>
                <p className="text-[10px] text-muted-foreground">
                  Scanning Recreation.gov for new permit availability...
                </p>
              </div>
              <Search size={13} className="text-muted-foreground/50 shrink-0" />
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
                      className="rounded-lg bg-status-found/5 border border-status-found/15 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-found opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-found" />
                        </span>
                        <span className="text-[11px] text-foreground font-medium truncate flex-1">
                          {f.permit_name}
                        </span>
                        {!filterParkFinds && (
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
                              +{f.available_dates!.length - 3}
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

          {!loadingFinds && finds.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 px-1">
              <Radio size={9} className="text-primary animate-pulse" />
              <span className="text-[9px] text-muted-foreground">
                Scanner active · monitoring for cancellations
              </span>
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
            <div className="rounded-xl bg-muted/20 border border-border px-4 py-3.5">
              <p className="text-[11px] text-muted-foreground">No recent permit activity detected yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence mode="popLayout">
                {activity.map((item, i) => {
                  const parkName = PARKS[item.park_id]?.shortName ?? item.park_id;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 30 }}
                      className="rounded-lg bg-card border border-border px-3 py-2.5"
                    >
                      <p className="text-[12px] font-medium text-foreground leading-tight">
                        {parkName} — {item.permit_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Detected {formatDistanceToNow(new Date(item.found_at), { addSuffix: false })} ago
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PermitFeed;
