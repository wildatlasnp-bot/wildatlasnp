import { useState, useEffect, useCallback } from "react";
import { Radar, Zap, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DiscoverScannerCard = () => {
  const { user } = useAuth();
  const [scannerStatus, setScannerStatus] = useState<"active" | "delayed" | "unknown">("unknown");
  const [trackingCount, setTrackingCount] = useState(0);
  const [lastFoundAgo, setLastFoundAgo] = useState<string | null>(null);

  useEffect(() => {
    // Check scanner heartbeat
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
    // Get user's active watch count
    supabase
      .from("active_watches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ count }) => setTrackingCount(count ?? 0));

    // Get last find time
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
          {/* Pulse indicator + icon */}
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

          {/* Content */}
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
              Monitoring Recreation.gov for cancellations
            </p>
          </div>

          {/* Arrow */}
          <ChevronRight size={14} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2.5 pl-11">
          {lastFoundAgo && (
            <div className="flex items-center gap-1.5">
              <Zap size={10} className="text-status-quiet/70" />
              <span className="text-[10px] text-muted-foreground font-medium">
                Last find: {lastFoundAgo}
              </span>
            </div>
          )}
          {trackingCount > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {trackingCount} permit{trackingCount !== 1 ? "s" : ""} tracked
            </span>
          )}
          {!user && (
            <span className="text-[10px] text-primary font-semibold">
              View Permit Tracker →
            </span>
          )}
        </div>
      </a>
    </motion.div>
  );
};

export default DiscoverScannerCard;
