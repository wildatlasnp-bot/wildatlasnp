import { useState, useEffect } from "react";
import { Radar, Zap, ChevronRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DiscoverScannerCard = () => {
  const { user } = useAuth();
  const [scannerStatus, setScannerStatus] = useState<"active" | "delayed" | "unknown">("unknown");
  const [trackingCount, setTrackingCount] = useState(0);
  const [lastFoundAgo, setLastFoundAgo] = useState<string | null>(null);

  useEffect(() => {
    const checkHeartbeat = async () => {
      const { data } = await supabase
        .from("permit_cache")
        .select("fetched_at")
        .eq("cache_key", "__scanner_heartbeat__")
        .maybeSingle();
      if (!data) { setScannerStatus("unknown"); return; }
      const ageMs = Date.now() - new Date(data.fetched_at).getTime();
      setScannerStatus(ageMs > 10 * 60_000 ? "delayed" : "active");
    };
    checkHeartbeat();
    const hbInterval = setInterval(checkHeartbeat, 60_000);
    return () => clearInterval(hbInterval);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("active_watches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ count }) => setTrackingCount(count ?? 0));

    supabase
      .from("recent_finds")
      .select("found_at")
      .order("found_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          const seconds = Math.floor((Date.now() - new Date(data[0].found_at).getTime()) / 1000);
          if (seconds < 60) setLastFoundAgo("just now");
          else if (seconds < 3600) setLastFoundAgo(`${Math.floor(seconds / 60)}m ago`);
          else if (seconds < 86400) setLastFoundAgo(`${Math.floor(seconds / 3600)}h ago`);
          else setLastFoundAgo(`${Math.floor(seconds / 86400)}d ago`);
        }
      });
  }, [user]);

  const isActive = scannerStatus === "active";
  const hasWatches = trackingCount > 0;

  // ── Empty state: no watches yet ──
  if (!hasWatches) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <a
          href="/sniper"
          className="block rounded-xl border border-border border-dashed bg-muted/30 p-3.5 hover:bg-muted/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Plus size={15} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                Permit Scanner
              </span>
              <p className="text-[11px] text-muted-foreground/80 font-medium mt-0.5 leading-snug">
                Track permits and get alerted when cancellations open up
              </p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </div>
          <div className="mt-2.5 pl-11">
            <span className="text-[10px] text-primary font-semibold">
              Start tracking permits →
            </span>
          </div>
        </a>
      </motion.div>
    );
  }

  // ── Active state: user has watches ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
    >
      <a
        href="/sniper"
        className="block rounded-xl border border-status-quiet/20 bg-status-quiet/6 p-3.5 hover:bg-status-quiet/10 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-status-quiet/15 flex items-center justify-center">
              <Radar size={15} className="text-status-quiet" />
            </div>
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-quiet opacity-40" style={{ animationDuration: "2s" }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-quiet" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-status-quiet">
                Permit Scanner
              </span>
              {isActive && (
                <span className="text-[9px] font-bold text-status-quiet/70">· Running</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-snug">
              Tracking {trackingCount} permit{trackingCount !== 1 ? "s" : ""} on Recreation.gov
            </p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </div>

        {lastFoundAgo && (
          <div className="flex items-center gap-1.5 mt-2.5 pl-11">
            <Zap size={10} className="text-status-quiet/70" />
            <span className="text-[10px] text-muted-foreground font-medium">
              Last find: {lastFoundAgo}
            </span>
          </div>
        )}
      </a>
    </motion.div>
  );
};

export default DiscoverScannerCard;
