import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, Info, ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ParkAlert {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  last_updated: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  Danger: { icon: AlertTriangle, className: "bg-status-peak/10 text-status-peak border-status-peak/20" },
  Caution: { icon: ShieldAlert, className: "bg-status-building/10 text-status-building border-status-building/20" },
  "Park Closure": { icon: AlertTriangle, className: "bg-status-peak/10 text-status-peak border-status-peak/20" },
  Information: { icon: Info, className: "bg-primary/8 text-primary border-primary/20" },
};

type HeaderStatus = "idle" | "checking" | "no_new" | "error";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ParkAlerts = React.forwardRef<HTMLDivElement, { parkId?: string }>(({ parkId }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>("idle");
  const [showOlder, setShowOlder] = useState(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const loadAlerts = useCallback(async () => {
    let query = supabase
      .from("park_alerts")
      .select("id, title, description, category, url, last_updated")
      .order("last_updated", { ascending: false })
      .limit(20);
    if (parkId) {
      query = query.eq("park_id", parkId);
    }
    const { data, error } = await query;
    if (error) throw error;
    setAlerts(data ?? []);
    setLastFetchedAt(Date.now());
  }, [parkId]);

  useEffect(() => {
    setLoading(true);
    setHeaderStatus("idle");
    setShowOlder(false);
    loadAlerts()
      .catch(() => setHeaderStatus("error"))
      .finally(() => setLoading(false));
  }, [loadAlerts]);

  const handleRefresh = async () => {
    if (headerStatus === "checking") return;
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setHeaderStatus("checking");
    try {
      const prevIds = new Set(alerts.map((a) => a.id));
      const { error } = await supabase.functions.invoke("nps-alerts");
      if (error) throw error;
      await loadAlerts();
      const newAlerts = alerts.filter((a) => !prevIds.has(a.id));
      if (newAlerts.length === 0) {
        setHeaderStatus("no_new");
        statusTimeoutRef.current = setTimeout(() => setHeaderStatus("idle"), 3000);
      } else {
        setHeaderStatus("idle");
      }
    } catch {
      setHeaderStatus("error");
    }
  };

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const { recentAlerts, olderAlerts } = useMemo(() => {
    const cutoff = Date.now() - SIX_MONTHS_MS;
    const recent: ParkAlert[] = [];
    const older: ParkAlert[] = [];
    for (const a of alerts) {
      if (new Date(a.last_updated).getTime() >= cutoff) {
        recent.push(a);
      } else {
        older.push(a);
      }
    }
    return { recentAlerts: recent, olderAlerts: older };
  }, [alerts]);

  const visibleAlerts = showOlder ? alerts : recentAlerts;

  if (loading || alerts.length === 0) return null;

  const statusLine = (() => {
    switch (headerStatus) {
      case "checking": return "Checking for updates…";
      case "no_new": return "No new alerts since last scan.";
      case "error": return "Unable to fetch alerts — tap to retry.";
      default:
        return lastFetchedAt > 0
          ? `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} · Updated ${timeAgo(lastFetchedAt)}`
          : `${alerts.length} alert${alerts.length !== 1 ? "s" : ""}`;
    }
  })();

  return (
    <div ref={ref} className="px-5 mb-5 border-t border-border/30 pt-6 mt-2">
      {/* Tappable header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 py-1 text-left"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0">
          <p className="text-[18px] font-bold tracking-tight text-foreground font-body">Park Alerts</p>
          <p className={`text-[12px] font-normal font-body mt-0.5 ${headerStatus === "error" ? "text-destructive" : "text-muted-foreground/70"}`}>
            {statusLine}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            className="flex items-center text-muted-foreground hover:text-secondary transition-colors p-1"
            aria-label="Refresh NPS alerts"
          >
            <RefreshCw size={12} className={headerStatus === "checking" ? "animate-spin" : ""} />
          </button>
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          />
        </div>
      </button>

      {/* Expandable list */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              {visibleAlerts.map((alert, i) => {
                const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG.Information;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-[18px] border p-4 ${config.className}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon size={14} className="shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold leading-snug line-clamp-2 font-body">
                            {alert.title}
                          </span>
                          {alert.url && (
                            <a
                              href={alert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        {alert.description && (
                          <p className="text-[13px] font-normal opacity-80 mt-1 line-clamp-2 leading-[1.5] font-body">
                            {alert.description}
                          </p>
                        )}
                        <span className="text-[12px] font-normal opacity-50 mt-1.5 block font-body">
                          {alert.category}{alert.last_updated ? ` · Posted ${alert.last_updated.slice(0, 10).replace(/-/g, "/").replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, (_m, y, mo, d) => `${parseInt(mo)}/${parseInt(d)}/${y}`)}` : ""}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Show older link */}
              {!showOlder && olderAlerts.length > 0 && (
                <button
                  onClick={() => setShowOlder(true)}
                  className="w-full text-center text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Show older alerts ({olderAlerts.length})
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ParkAlerts.displayName = "ParkAlerts";

export default ParkAlerts;
