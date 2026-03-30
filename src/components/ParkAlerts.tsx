import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, ChevronDown, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PARKS } from "@/lib/parks";

interface ParkAlert {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  last_updated: string;
  park_id: string;
}

interface ParkAlertsProps {
  parkId?: string;
  trackedParkIds?: Set<string>;
}

const CATEGORY_CONFIG: Record<string, { icon?: typeof AlertTriangle; className: string; style?: React.CSSProperties; pill?: { label: string; bg: string; color: string } }> = {
  Danger: {
    icon: AlertTriangle,
    className: "",
    style: { background: "#FEF0EF", border: "0.5px solid rgba(226,75,74,0.15)", borderLeft: "3px solid #E24B4A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Emergency", bg: "#FCEBEB", color: "#A32D2D" },
  },
  Caution: { icon: ShieldAlert, className: "bg-status-building/10 text-status-building border-status-building/20" },
  "Park Closure": {
    className: "",
    style: { background: "#FFFBF2", border: "0.5px solid rgba(181,131,10,0.2)", borderLeft: "3px solid #B5830A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Seasonal closure", bg: "#FEF3D0", color: "#7A5600" },
  },
  Information: {
    className: "",
    style: { background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.08)", borderLeft: "3px solid rgba(47, 111, 78, 0.45)", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Information", bg: "#EAF3DE", color: "#3B6D11" },
  },
};

type HeaderStatus = "idle" | "checking" | "no_new" | "error";
type FilterType = "all" | "closures" | "info" | string;

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

function formatPostedDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, "/").replace(
    /^(\d{4})\/(\d{2})\/(\d{2})$/,
    (_m, y, mo, d) => `${parseInt(mo)}/${parseInt(d)}/${y}`
  );
}

const CATEGORY_SORT_ORDER: Record<string, number> = {
  "Park Closure": 0,
  Danger: 1,
  Caution: 2,
  Information: 3,
};

function sortAlerts(list: ParkAlert[]): ParkAlert[] {
  return [...list].sort((a, b) => {
    const catA = CATEGORY_SORT_ORDER[a.category] ?? 99;
    const catB = CATEGORY_SORT_ORDER[b.category] ?? 99;
    if (catA !== catB) return catA - catB;
    return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
  });
}

const ParkAlerts = React.forwardRef<HTMLDivElement, ParkAlertsProps>(({ parkId, trackedParkIds }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>("idle");
  const [showOlder, setShowOlder] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const loadAlerts = useCallback(async () => {
    let query = supabase
      .from("park_alerts")
      .select("id, title, description, category, url, last_updated, park_id")
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
    setActiveFilter("all");
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

  // Counts
  const closureCount = useMemo(() => alerts.filter((a) => a.category === "Park Closure").length, [alerts]);
  const infoCount = useMemo(() => alerts.filter((a) => a.category === "Information").length, [alerts]);

  // Park chips — only for tracked parks
  const parkChips = useMemo(() => {
    if (!trackedParkIds || trackedParkIds.size === 0) return [];
    return Array.from(trackedParkIds)
      .map((id) => ({
        id,
        label: PARKS[id]?.shortName ?? id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [trackedParkIds]);

  // Subtitle
  const subtitle = `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} · includes your parks`;

  // Filtered + sorted
  const { recentAlerts, olderAlerts } = useMemo(() => {
    let filtered: ParkAlert[];
    if (activeFilter === "all") {
      filtered = alerts;
    } else if (activeFilter === "closures") {
      filtered = alerts.filter((a) => a.category === "Park Closure");
    } else if (activeFilter === "info") {
      filtered = alerts.filter((a) => a.category === "Information");
    } else {
      filtered = alerts.filter((a) => a.park_id === activeFilter);
    }

    const sorted = sortAlerts(filtered);
    const cutoff = Date.now() - SIX_MONTHS_MS;
    const recent: ParkAlert[] = [];
    const older: ParkAlert[] = [];
    for (const a of sorted) {
      if (new Date(a.last_updated).getTime() >= cutoff) {
        recent.push(a);
      } else {
        older.push(a);
      }
    }
    return { recentAlerts: recent, olderAlerts: older };
  }, [alerts, activeFilter]);

  const visibleAlerts = showOlder ? [...recentAlerts, ...olderAlerts] : recentAlerts;

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
            {/* Subtitle */}
            <p className="text-[11px] font-body mt-1 mb-2" style={{ color: "#aaaaaa" }}>
              {subtitle}
            </p>

            {/* Filter chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
              <FilterChip
                label="All"
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
              />
              <FilterChip
                label={`Closures ${closureCount}`}
                active={activeFilter === "closures"}
                onClick={() => setActiveFilter("closures")}
                activeStyle="closure"
              />
              <FilterChip
                label={`Info ${infoCount}`}
                active={activeFilter === "info"}
                onClick={() => setActiveFilter("info")}
              />
              {parkChips.map((p) => (
                <FilterChip
                  key={p.id}
                  label={p.label}
                  active={activeFilter === p.id}
                  onClick={() => setActiveFilter(p.id)}
                  variant="park"
                />
              ))}
            </div>

            <div className="space-y-3">
              {visibleAlerts.length === 0 && (
                <p className="text-[13px] text-muted-foreground font-body text-center py-4">No alerts match this filter</p>
              )}
              {visibleAlerts.map((alert, i) => {
                const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG.Information;
                const Icon = config.icon;
                const isInfo = alert.category === "Information";
                const isClosure = alert.category === "Park Closure";
                const titleColor = isClosure ? "#A32D2D" : isInfo ? "#1a1a1a" : undefined;
                const bodyColor = isClosure ? "#444444" : isInfo ? "#555555" : "#1a1a1a";
                const bodyOpacity = (isClosure || isInfo) ? 1 : 0.85;
                const metaColor = (isClosure || isInfo) ? "#aaaaaa" : "#9CA3AF";
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
                            style={titleColor ? { color: titleColor } : undefined}
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
                            style={{ color: bodyColor, opacity: bodyOpacity }}
                          >
                            {alert.description.replace(/^\d{2}\/\d{2}\/\d{4}\s*/, "")}
                          </p>
                        )}
                        <span
                          className="text-[12px] font-normal mt-1.5 block font-body"
                          style={{ color: metaColor }}
                        >
                          {config.pill ? "" : `${alert.category} · `}{alert.last_updated ? `Posted ${formatPostedDate(alert.last_updated)}` : ""}
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

/* ── Filter Chip ── */

function FilterChip({
  label,
  active,
  onClick,
  activeStyle = "default",
  variant = "generic",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeStyle?: "default" | "closure";
  variant?: "generic" | "park";
}) {
  const base = "whitespace-nowrap font-body cursor-pointer transition-colors select-none";
  const sizing = { fontSize: 11, padding: "5px 12px", borderRadius: 20 } as const;

  if (active) {
    const style: React.CSSProperties =
      activeStyle === "closure"
        ? { background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid rgba(226,75,74,0.2)" }
        : { background: "#2F6F4E", color: "#FFFFFF", border: "0.5px solid transparent" };
    return (
      <button onClick={onClick} className={base} style={{ ...style, ...sizing, fontWeight: variant === "park" ? 600 : 500 }}>
        {label}
      </button>
    );
  }

  // Inactive styles differ for park chips vs generic
  const inactiveStyle: React.CSSProperties = variant === "park"
    ? { background: "#FFFFFF", border: "1px solid rgba(47,111,78,0.35)", color: "#2F6F4E", fontWeight: 600 }
    : { background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.1)", color: "#555555", fontWeight: 500 };

  return (
    <button onClick={onClick} className={base} style={{ ...inactiveStyle, ...sizing }}>
      {label}
    </button>
  );
}
