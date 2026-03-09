import { useState, useEffect, useRef } from "react";
import { Radar, Zap, ChevronRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface DiscoverScannerCardProps {
  onNavigateToSniper?: () => void;
}

const DiscoverScannerCard = ({ onNavigateToSniper }: DiscoverScannerCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const goToSniper = () => { if (onNavigateToSniper) onNavigateToSniper(); else navigate("/app?tab=sniper"); };
  const [scannerStatus, setScannerStatus] = useState<"active" | "delayed" | "unknown">("unknown");
  const [trackingCount, setTrackingCount] = useState(0);
  const [lastFoundAgo, setLastFoundAgo] = useState<string | null>(null);
  const [shimmer, setShimmer] = useState(false);
  const lastFindIdRef = useRef<string | null>(null);

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
      .from("user_watchers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ count }) => setTrackingCount(count ?? 0));

    supabase
      .from("recent_finds")
      .select("id, found_at")
      .order("found_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          lastFindIdRef.current = data[0].id;
          const seconds = Math.floor((Date.now() - new Date(data[0].found_at).getTime()) / 1000);
          if (seconds < 60) setLastFoundAgo("just now");
          else if (seconds < 3600) setLastFoundAgo(`${Math.floor(seconds / 60)}m ago`);
          else if (seconds < 86400) setLastFoundAgo(`${Math.floor(seconds / 3600)}h ago`);
          else setLastFoundAgo(`${Math.floor(seconds / 86400)}d ago`);
        }
      });

    // Listen for new finds in realtime
    const channel = supabase
      .channel("discover-finds")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recent_finds" },
        (payload) => {
          const row = payload.new as { id: string; found_at: string; permit_name?: string; location_name?: string };
          if (row.id !== lastFindIdRef.current) {
            lastFindIdRef.current = row.id;
            setLastFoundAgo("just now");
            setShimmer(true);
            setTimeout(() => setShimmer(false), 2000);
            toast({
              title: "🎯 Availability detected",
              description: row.permit_name
                ? `${row.permit_name}${row.location_name ? ` · ${row.location_name}` : ""}`
                : "A new opening was just detected.",
              action: (
                <button
                  onClick={goToSniper}
                  className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
                >
                  View Tracker →
                </button>
              ),
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
        <div className="rounded-[18px] border bg-card text-card-foreground p-4" style={{ boxShadow: "var(--card-shadow)" }}>
          <h3 className="text-[13px] font-semibold text-foreground">
            Track your first permit
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-snug">
            Monitor cancellations and get alerts when permits become available.
          </p>
          <button
            onClick={goToSniper}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold px-3.5 py-2 hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            Track a Permit
          </button>
        </div>
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
      <button
        onClick={goToSniper}
        className="w-full text-left relative block rounded-[18px] border border-status-quiet/20 bg-status-quiet/6 p-3.5 hover:bg-status-quiet/10 transition-colors group overflow-hidden"
      >
        {/* Shimmer overlay */}
        {shimmer && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-y-0 w-[60%] bg-gradient-to-r from-transparent via-status-quiet/15 to-transparent skew-x-[-20deg]"
              initial={{ left: "-60%" }}
              animate={{ left: "120%" }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          </motion.div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-status-quiet/15 flex items-center justify-center">
              <Radar size={15} className="text-status-quiet" />
            </div>
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-status-quiet status-dot-pulse" />
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
            <Zap size={10} className={shimmer ? "text-status-quiet" : "text-status-quiet/70"} />
            <span className={`text-[10px] font-medium transition-colors duration-500 ${shimmer ? "text-status-quiet font-semibold" : "text-muted-foreground"}`}>
              Last find: {lastFoundAgo}
            </span>
          </div>
        )}
      </button>
    </motion.div>
  );
};

export default DiscoverScannerCard;
