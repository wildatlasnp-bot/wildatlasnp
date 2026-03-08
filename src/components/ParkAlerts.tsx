import React, { useEffect, useState, useCallback, useRef } from "react";
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

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const ParkAlerts = React.forwardRef<HTMLDivElement, { parkId?: string }>(({ parkId }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("wildatlas_alerts_collapsed") === "true");
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>("idle");
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [, forceRender] = useState(0);

  // Tick every 30s to keep "Last updated X min ago" fresh
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
    loadAlerts()
      .catch(() => setHeaderStatus("error"))
      .finally(() => setLoading(false));
  }, [loadAlerts]);

  const handleRefresh = async () => {
    if (headerStatus === "checking") return;

    // Clear any previous transient status
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setHeaderStatus("checking");

    try {
      const prevIds = new Set(alerts.map((a) => a.id));
      const { error } = await supabase.functions.invoke("nps-alerts");
      if (error) throw error;
      await loadAlerts();

      // Check if any new alerts appeared
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

  if (loading || alerts.length === 0) return null;

  const headerText = (() => {
    switch (headerStatus) {
      case "checking":
        return "Checking for updates…";
      case "no_new":
        return "No new alerts since last scan.";
      case "error":
        return "Unable to fetch alerts — tap to retry.";
      default:
        return `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} · Updates every 5 min`;
    }
  })();

  return (
    <div ref={ref} className="px-5 mb-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <p className="text-[17px] font-semibold text-foreground font-body">
          Park Alerts
        </p>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-secondary transition-colors"
          aria-label="Refresh NPS alerts"
        >
          <RefreshCw size={10} className={headerStatus === "checking" ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setCollapsed((c) => { const next = !c; localStorage.setItem("wildatlas_alerts_collapsed", String(next)); return next; })}
          className="ml-auto flex items-center text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand alerts" : "Collapse alerts"}
        >
          <ChevronDown size={12} className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-1.5 mb-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={headerStatus}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`text-[12px] font-normal font-body ${headerStatus === "error" ? "text-destructive" : "text-foreground/65"}`}
          >
            {headerText}
          </motion.p>
        </AnimatePresence>
        {headerStatus === "idle" && lastFetchedAt > 0 && (
          <span className="text-[12px] font-normal text-foreground/65">
            · Last updated {timeAgo(lastFetchedAt)}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {alerts.map((alert, i) => {
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ParkAlerts.displayName = "ParkAlerts";

export default ParkAlerts;
