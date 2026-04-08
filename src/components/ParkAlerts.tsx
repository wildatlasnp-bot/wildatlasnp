import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, ShieldAlert, Info } from "lucide-react";
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

const CATEGORY_CONFIG: Record<string, { icon?: typeof AlertTriangle; iconColor?: string; className: string; style?: React.CSSProperties; pill?: { label: string; bg: string; color: string } }> = {
  Danger: {
    icon: AlertTriangle,
    iconColor: "#A32D2D",
    className: "",
    style: { background: "#FEF0EF", border: "0.5px solid rgba(226,75,74,0.15)", borderLeft: "3px solid #E24B4A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Emergency", bg: "#FCEBEB", color: "#A32D2D" },
  },
  Caution: {
    icon: AlertTriangle,
    iconColor: "#B5830A",
    className: "",
    style: { background: "#FFFBF2", border: "0.5px solid rgba(181,131,10,0.2)", borderLeft: "3px solid #B5830A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Caution", bg: "#FEF3D0", color: "#7A5600" },
  },
  "Park Closure": {
    icon: ShieldAlert,
    iconColor: "#B5830A",
    className: "",
    style: { background: "#FFFBF2", border: "0.5px solid rgba(181,131,10,0.2)", borderLeft: "3px solid #B5830A", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Seasonal closure", bg: "#faeeda", color: "#BA7517" },
  },
  Information: {
    icon: Info,
    iconColor: "#2F6F4E",
    className: "",
    style: { background: "rgba(47,111,78,0.06)", border: "0.5px solid rgba(47,111,78,0.15)", borderLeft: "3px solid #2F6F4E", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    pill: { label: "Information", bg: "rgba(47,111,78,0.12)", color: "#2F6F4E" },
  },
};

type HeaderStatus = "idle" | "checking" | "no_new" | "error";
type FilterType = "all" | "closures" | "info" | string;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

// Sort: unread first, then by recency within each group
function sortAlerts(list: ParkAlert[], readIds: Set<string>): ParkAlert[] {
  return [...list].sort((a, b) => {
    const aRead = readIds.has(a.id) ? 1 : 0;
    const bRead = readIds.has(b.id) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead; // unread (0) before read (1)
    return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
  });
}

const ParkAlerts = React.forwardRef<HTMLDivElement, ParkAlertsProps>(({ parkId, trackedParkIds }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
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

  const loadReads = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("user_alert_reads")
      .select("alert_id")
      .eq("user_id", session.user.id);
    if (data) setReadAlertIds(new Set(data.map((r) => r.alert_id)));
  }, []);

  useEffect(() => {
    setLoading(true);
    setHeaderStatus("idle");
    setShowOlder(false);
    setActiveFilter("all");
    Promise.all([
      loadAlerts().catch(() => setHeaderStatus("error")),
      loadReads(),
    ]).finally(() => setLoading(false));
  }, [loadAlerts, loadReads]);

  const handleRead = useCallback(async (alertId: string) => {
    setReadAlertIds((prev) => new Set([...prev, alertId]));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("user_alert_reads").upsert(
      { user_id: session.user.id, alert_id: alertId, read_at: new Date().toISOString() },
      { onConflict: "user_id,alert_id", ignoreDuplicates: true }
    );
  }, []);

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

  // Filtered + sorted, split into recent (≤30 days) and older
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

    const sorted = sortAlerts(filtered, readAlertIds);
    const cutoff = Date.now() - THIRTY_DAYS_MS;
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
  }, [alerts, activeFilter, readAlertIds]);

  const visibleAlerts = showOlder ? [...recentAlerts, ...olderAlerts] : recentAlerts;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 py-1">
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-3 mt-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[14px] p-4 border border-border/40 bg-card animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-4 w-4 rounded bg-muted" />
                <div className="h-3 w-16 rounded-full bg-muted" />
              </div>
              <div className="h-4 w-[70%] rounded bg-muted mb-1.5" />
              <div className="h-3 w-[90%] rounded bg-muted mb-1" />
              <div className="h-3 w-24 rounded bg-muted mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (headerStatus === "error" && alerts.length === 0) {
    return (
      <div className="mb-5">
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500, color: "#1A1A1A" }}>Park alerts</p>
        <div
          className="mt-3 rounded-[14px] p-4"
          style={{ background: "rgba(198,40,40,0.06)", border: "1px solid rgba(198,40,40,0.15)" }}
        >
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#A32D2D" }}>
            Couldn't load park alerts
          </p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A32D2D", opacity: 0.7, marginTop: 2 }}>
            Check your connection and pull to refresh.
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (alerts.length === 0) {
    return (
      <div className="mb-5">
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500, color: "#1A1A1A" }}>Park alerts</p>
        <div
          className="mt-3 rounded-[14px] p-5 flex flex-col items-center text-center"
          style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(28,24,18,0.08)" }}
        >
          <img src="/mochi-neutral.png" alt="Poko" style={{ width: 48, height: 48, objectFit: "contain", marginBottom: 8 }} loading="lazy" />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontStyle: "italic", color: "#3A3E3B" }}>
            No alerts for your parks right now — that's a good sign.
          </p>
        </div>
      </div>
    );
  }

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
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500, color: "#1A1A1A", letterSpacing: "0" }}>Park alerts</p>
          <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(28,24,18,0.35)", fontFamily: "'DM Sans', sans-serif", marginLeft: 4 }}>{inlineBadge}</span>
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
              {visibleAlerts.map((alert, i) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  index={i}
                  isUnread={!readAlertIds.has(alert.id)}
                  onRead={handleRead}
                />
              ))}

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

/* ── Alert Card ── */

function AlertCard({
  alert,
  isUnread,
  onRead,
  index,
}: {
  alert: ParkAlert;
  isUnread: boolean;
  onRead: (id: string) => void;
  index: number;
}) {
  const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG.Information;
  const IconComp = config.icon;
  const isInfo = alert.category === "Information";
  const isSafetyCritical = /danger|emergency|evacuation/i.test(alert.category);
  const isAmber = alert.category === "Park Closure" || alert.category === "Caution";
  const titleColor = isSafetyCritical ? "#E24B4A" : isAmber ? "#BA7517" : isInfo ? "#1a1a1a" : "#1a1a1a";
  const bodyColor = alert.category === "Park Closure" ? "#444444" : isInfo ? "#555555" : "#1a1a1a";
  const bodyOpacity = (alert.category === "Park Closure" || isInfo) ? 1 : 0.85;
  const metaColor = (alert.category === "Park Closure" || isInfo) ? "#aaaaaa" : "#9CA3AF";
  const [expanded, setExpanded] = useState(!isInfo);

  // Mute background of read Information cards; leave amber cards untouched
  const cardStyle: React.CSSProperties = useMemo(() => {
    if (!isUnread && !isAmber && config.style) {
      return { ...config.style, background: "#F8F8F6" };
    }
    return config.style ?? {};
  }, [isUnread, isAmber, config.style]);

  // Non-info alerts are always expanded — mark as read on mount
  useEffect(() => {
    if (!isInfo && isUnread) {
      onRead(alert.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && isUnread) {
      onRead(alert.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isUnread ? 1 : 0.7, y: 0 }}
      transition={{ opacity: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }, delay: index * 0.05 }}
      className={`tactile-card rounded-[14px] p-4 ${config.className}`}
      style={cardStyle}
      onClick={isInfo ? handleToggle : undefined}
      role={isInfo ? "button" : undefined}
      tabIndex={isInfo ? 0 : undefined}
      onKeyDown={isInfo ? (e) => e.key === "Enter" && handleToggle() : undefined}
    >
      <div className="flex-1 min-w-0">
        {/* Pill row with icon */}
        {config.pill && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {IconComp && <IconComp size={16} color={config.iconColor} className="shrink-0" />}
            <span
              className="inline-block font-body"
              style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: config.pill.bg, color: config.pill.color }}
            >
              {config.pill.label}
            </span>
          </div>
        )}
        {/* Title row */}
        <div className="flex items-center gap-2">
        {isUnread && (Date.now() - new Date(alert.last_updated).getTime() < 72 * 60 * 60 * 1000) && (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "#2F6F4E",
                color: "#FFFFFF",
                padding: "2px 4px",
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              NEW
            </span>
          )}
          <span
            className="text-[14px] font-semibold leading-snug line-clamp-2 font-body flex-1"
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
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44, margin: "-12px -12px -12px 0", padding: 12 }}
            >
              <ExternalLink size={11} />
            </a>
          )}
          {isInfo && (
            expanded
              ? <ChevronUp size={14} className="shrink-0" style={{ color: "rgba(28,24,18,0.35)" }} />
              : <ChevronDown size={14} className="shrink-0" style={{ color: "rgba(28,24,18,0.35)" }} />
          )}
        </div>
        {/* Description — always shown for non-info, toggled for info */}
        {alert.description && (!isInfo || expanded) && (
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
    </motion.div>
  );
}


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
  const sizing = { fontSize: 11, padding: "5px 12px", borderRadius: 20, minHeight: 44, display: "inline-flex" as const, alignItems: "center" as const } as const;

  if (active) {
    const style: React.CSSProperties =
      activeStyle === "closure"
        ? { background: "#FEF3D0", color: "#7A5600", border: "0.5px solid rgba(181,131,10,0.3)" }
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
