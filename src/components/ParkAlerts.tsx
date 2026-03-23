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

const CATEGORY_CONFIG: Record<string, { icon?: typeof AlertTriangle; className: string; style?: React.CSSProperties; pill?: { label: string; bg: string; color: string } }> = {
  Danger: { icon: AlertTriangle, className: "text-status-peak", style: { background: "rgba(226, 75, 74, 0.08)", borderLeft: "3px solid #E24B4A", border: "1px solid rgba(226, 75, 74, 0.15)", borderLeftWidth: 3, borderLeftColor: "#E24B4A" } },
  Caution: { icon: ShieldAlert, className: "bg-status-building/10 text-status-building border-status-building/20" },
  "Park Closure": {
    className: "",
    style: { background: "#FEF0EF", border: "0.5px solid rgba(226,75,74,0.15)", borderLeft: "3px solid #E24B4A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Park closure", bg: "#FCEBEB", color: "#A32D2D" },
  },
  Information: { icon: Info, className: "text-primary", style: { background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.07)" } },
};

type HeaderStatus = "idle" | "checking" | "no_new" | "error";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
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

  const inlineBadge = (() => {
    if (headerStatus === "checking") return "checking…";
    if (headerStatus === "error") return "error";
    const count = alerts.length;
    const time = lastFetchedAt > 0 ? timeAgo(lastFetchedAt) : null;
    return time ? `${count} · ${time}` : `${count}`;
  })();

  return (
    <div ref={ref} className="mb-5">
      {/* Tappable header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 py-1 text-left cursor-pointer"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[18px] font-bold tracking-tight text-foreground font-body">Park alerts</p>
          <span className="text-[11px] font-medium text-muted-foreground/60 font-body">{inlineBadge}</span>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
        />
      </div>

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
                const isClosure = alert.category === "Park Closure";
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-[18px] p-4 ${config.className}`}
                    style={config.style}
                  >
                    <div className="flex items-start gap-2.5">
                      {Icon && <Icon size={14} className="shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        {config.pill && (
                          <span
                            className="inline-block mb-1.5 font-body"
                            style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: config.pill.bg, color: config.pill.color }}
                          >
                            {config.pill.label}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[14px] font-semibold leading-snug line-clamp-2 font-body"
                            style={isClosure ? { color: "#A32D2D" } : undefined}
                          >
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
                          <p
                            className="text-[13px] font-normal mt-1 line-clamp-2 leading-[1.5] font-body"
                            style={{ color: isClosure ? "#444444" : "#1a1a1a", opacity: isClosure ? 1 : 0.85 }}
                          >
                            {alert.description}
                          </p>
                        )}
                        <span
                          className="text-[12px] font-normal mt-1.5 block font-body"
                          style={{ color: isClosure ? "#aaaaaa" : "#9CA3AF" }}
                        >
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
