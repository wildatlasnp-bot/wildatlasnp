import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { formatDistanceToNow } from "date-fns";

interface PermitFind {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
}

interface LivePermitActivityProps {
  parkId?: string;
}

const LivePermitActivity = ({ parkId }: LivePermitActivityProps) => {
  const [items, setItems] = useState<PermitFind[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPark, setFilterPark] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from("recent_finds")
      .select("id, park_id, permit_name, found_at")
      .order("found_at", { ascending: false })
      .limit(5);

    if (filterPark && parkId) {
      query = query.eq("park_id", parkId);
    }

    const { data } = await query;
    if (!mountedRef.current) return;
    setItems((data ?? []) as PermitFind[]);
    setLoading(false);
  }, [filterPark, parkId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Realtime — append new finds with client-side filtering
  useEffect(() => {
    const channel = supabase
      .channel("live-permit-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recent_finds" },
        (payload) => {
          if (!mountedRef.current) return;
          const newItem = payload.new as PermitFind;
          if (filterPark && parkId && newItem.park_id !== parkId) return;
          setItems((prev) => [newItem, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filterPark, parkId]);

  const currentParkName = parkId ? PARKS[parkId]?.shortName ?? parkId : "All Parks";

  return (
    <div className="px-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
            Live Permit Activity
          </span>
        </div>
        <button
          onClick={() => setFilterPark((p) => !p)}
          className="text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          {filterPark ? "All parks" : currentParkName}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading activity…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-muted/20 border border-border px-4 py-3.5">
          <p className="text-[11px] text-muted-foreground">No recent permit activity detected yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => {
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
    </div>
  );
};

export default LivePermitActivity;
