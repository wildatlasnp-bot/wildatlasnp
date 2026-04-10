import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronDown, ExternalLink, ShieldAlert, Info } from "lucide-react";
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
    style: { background: "#FEF0EF", border: "none", borderLeft: "4px solid #E24B4A", borderRadius: 0 },
    pill: { label: "Emergency", bg: "#FCEBEB", color: "#A32D2D" },
  },
  Caution: {
    icon: AlertTriangle,
    iconColor: "#B5830A",
    className: "",
    style: { background: "rgba(201,169,110,0.08)", border: "none", borderLeft: "4px solid #C9A96E", borderRadius: 0 },
    pill: { label: "Caution", bg: "rgba(201,169,110,0.18)", color: "#8B6914" },
  },
  "Park Closure": {
    icon: ShieldAlert,
    iconColor: "#8B6914",
    className: "",
    style: { background: "rgba(201,169,110,0.08)", border: "none", borderLeft: "4px solid #C9A96E", borderRadius: 0 },
    pill: { label: "Seasonal closure", bg: "rgba(201,169,110,0.18)", color: "#8B6914" },
  },
  Information: {
    icon: Info,
    iconColor: "#2F6F4E",
    className: "",
    style: { background: "#F0EDEA", border: "none", borderLeft: "4px solid #2F6F4E", borderRadius: 0 },
    pill: { label: "Information", bg: "rgba(47,111,78,0.12)", color: "#2F6F4E" },
  },
};

type HeaderStatus = "idle" | "checking" | "no_new" | "error";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

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

function sortAlerts(list: ParkAlert[], readIds: Set<string>): ParkAlert[] {
  return [...list].sort((a, b) => {
    const aRead = readIds.has(a.id) ? 1 : 0;
    const bRead = readIds.has(b.id) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
  });
}

const DM_SANS = "'DM Sans', sans-serif";

const ParkAlerts = React.forwardRef<HTMLDivElement, ParkAlertsProps>(({ parkId, trackedParkIds }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>("idle");
  const [showOlder, setShowOlder] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [, forceRender] = useState(0);

  // Dual-category filter state
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [activeParkFilter, setActiveParkFilter] = useState<string | null>(null);
  const [zeroResultMsg, setZeroResultMsg] = useState<string | null>(null);
  const zeroResultTimer = useRef<ReturnType<typeof setTimeout>>();

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
    setShowArchived(false);
    setActiveTypeFilter(null);
    setActiveParkFilter(null);
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
      if (zeroResultTimer.current) clearTimeout(zeroResultTimer.current);
    };
  }, []);

  /* ── Data-driven chip generation ── */

  // Alerts filtered by current park selection (for dynamic type counts)
  const parkFilteredAlerts = useMemo(() => {
    if (!activeParkFilter) return alerts;
    return alerts.filter((a) => a.park_id === activeParkFilter);
  }, [alerts, activeParkFilter]);

  // Type chips: derive from actual category values present in alerts
  const typeChips = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of parkFilteredAlerts) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ id: cat, label: cat === "Park Closure" ? "Closures" : cat, count }));
  }, [parkFilteredAlerts]);

  // Park chips: only parks with alerts AND tracked by user
  const parkChips = useMemo(() => {
    const parkIdsInAlerts = new Set(alerts.map((a) => a.park_id));
    const tracked = trackedParkIds ?? new Set<string>();
    return Array.from(tracked)
      .filter((id) => parkIdsInAlerts.has(id))
      .map((id) => ({
        id,
        label: PARKS[id]?.shortName ?? id,
        count: alerts.filter((a) => a.park_id === id).length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [alerts, trackedParkIds]);

  // Apply both filters (AND logic)
  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (activeTypeFilter) {
      // Map chip label back to category
      const cat = activeTypeFilter === "Closures" ? "Park Closure" : activeTypeFilter;
      result = result.filter((a) => a.category === cat);
    }
    if (activeParkFilter) {
      result = result.filter((a) => a.park_id === activeParkFilter);
    }
    return result;
  }, [alerts, activeTypeFilter, activeParkFilter]);

  // Zero-result auto-reset
  useEffect(() => {
    if ((activeTypeFilter || activeParkFilter) && filteredAlerts.length === 0 && alerts.length > 0) {
      const typeName = activeTypeFilter ?? "";
      const parkName = activeParkFilter ? (PARKS[activeParkFilter]?.shortName ?? activeParkFilter) : "";
      const msg = typeName && parkName
        ? `No ${typeName.toLowerCase()} alerts for ${parkName}`
        : `No ${typeName.toLowerCase() || parkName} alerts`;
      setZeroResultMsg(msg);
      if (zeroResultTimer.current) clearTimeout(zeroResultTimer.current);
      zeroResultTimer.current = setTimeout(() => {
        setActiveTypeFilter(null);
        setActiveParkFilter(null);
        setZeroResultMsg(null);
      }, 2000);
    } else {
      setZeroResultMsg(null);
    }
  }, [filteredAlerts.length, activeTypeFilter, activeParkFilter, alerts.length]);

  const handleAllClick = () => {
    setActiveTypeFilter(null);
    setActiveParkFilter(null);
  };

  const handleTypeClick = (chipLabel: string) => {
    setActiveTypeFilter((prev) => (prev === chipLabel ? null : chipLabel));
  };

  const handleParkClick = (parkId: string) => {
    setActiveParkFilter((prev) => (prev === parkId ? null : parkId));
  };

  const isAllActive = !activeTypeFilter && !activeParkFilter;

  // Subtitle
  const subtitle = `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} · includes your parks`;

  // Filtered + sorted, split into recent / older / archived
  const { recentAlerts, olderAlerts, archivedAlerts } = useMemo(() => {
    const sorted = sortAlerts(filteredAlerts, readAlertIds);
    const cutoff30 = Date.now() - THIRTY_DAYS_MS;
    const cutoff18m = Date.now() - EIGHTEEN_MONTHS_MS;
    const recent: ParkAlert[] = [];
    const older: ParkAlert[] = [];
    const archived: ParkAlert[] = [];
    for (const a of sorted) {
      const t = new Date(a.last_updated).getTime();
      if (t < cutoff18m) archived.push(a);
      else if (t >= cutoff30) recent.push(a);
      else older.push(a);
    }
    return { recentAlerts: recent, olderAlerts: older, archivedAlerts: archived };
  }, [filteredAlerts, readAlertIds]);

  const visibleAlerts = showOlder ? [...recentAlerts, ...olderAlerts] : recentAlerts;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 py-1">
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
        </div>
        {/* Chip skeleton pills */}
        <div className="flex gap-1.5 mt-3 mb-3">
          {[48, 72, 56].map((w, i) => (
            <div
              key={i}
              style={{
                width: w,
                height: 32,
                borderRadius: 20,
                animation: "chipSkeletonPulse 1.2s ease-in-out infinite",
                background: "rgba(0,0,0,0.06)",
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes chipSkeletonPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
        `}</style>
        <div className="space-y-3">
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
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: "#1A2F1E", lineHeight: 1.2 }}>Park alerts</p>
        <div
          className="mt-3 rounded-[14px] p-4"
          style={{ background: "rgba(198,40,40,0.06)", border: "1px solid rgba(198,40,40,0.15)" }}
        >
          <p style={{ fontFamily: DM_SANS, fontSize: 13, fontWeight: 500, color: "#A32D2D" }}>
            Couldn't load park alerts
          </p>
          <p style={{ fontFamily: DM_SANS, fontSize: 12, color: "#A32D2D", opacity: 0.7, marginTop: 2 }}>
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
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: "#1A2F1E", lineHeight: 1.2 }}>Park alerts</p>
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
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", fontWeight: 400, color: "#1A2F1E", lineHeight: 1.2 }}>Park alerts</p>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#8A8A7A", fontFamily: DM_SANS, marginLeft: 4 }}>{inlineBadge}</span>
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
            <p className="font-body mt-1 mb-2" style={{ color: "#aaaaaa", fontFamily: DM_SANS, fontSize: 13 }}>
              {subtitle}
            </p>

            {/* ── Data-driven filter chips ── */}
            <div
              className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                maskImage: "linear-gradient(to right, #F0EDEA 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, #F0EDEA 85%, transparent 100%)",
              } as React.CSSProperties}
            >
              {/* All chip — always first */}
              <FilterChip
                label="All"
                active={isAllActive}
                onClick={handleAllClick}
              />

              {/* Type chips */}
              {typeChips.map((tc) => (
                <FilterChip
                  key={tc.id}
                  label={tc.label}
                  count={tc.count}
                  active={activeTypeFilter === tc.label}
                  onClick={() => handleTypeClick(tc.label)}
                />
              ))}

              {/* Separator between type and park chips */}
              {typeChips.length > 0 && parkChips.length > 0 && (
                <div style={{ width: 1, height: 20, background: "rgba(0,0,0,0.12)", flexShrink: 0, alignSelf: "center", margin: "0 4px" }} />
              )}

              {/* Park chips */}
              {parkChips.map((p) => (
                <FilterChip
                  key={p.id}
                  label={p.label}
                  active={activeParkFilter === p.id}
                  onClick={() => handleParkClick(p.id)}
                />
              ))}
            </div>

            {/* Zero-result inline message */}
            <AnimatePresence>
              {zeroResultMsg && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ fontFamily: DM_SANS, fontSize: 12, color: "#A8A89A", textAlign: "center", padding: "4px 0 8px" }}
                >
                  {zeroResultMsg}
                </motion.p>
              )}
            </AnimatePresence>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleAlerts.length === 0 && !zeroResultMsg && (
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
              {(!showOlder && olderAlerts.length > 0) || archivedAlerts.length > 0 ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <button
                    onClick={() => {
                      if (!showOlder && olderAlerts.length > 0) {
                        setShowOlder(true);
                      } else {
                        setShowArchived((v) => !v);
                      }
                    }}
                    style={{
                      fontFamily: DM_SANS,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#2F6F4E",
                      background: "transparent",
                      border: "1.5px solid rgba(47,111,78,0.4)",
                      borderRadius: 12,
                      cursor: "pointer",
                      height: 48,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 16px",
                      maxWidth: "calc(100% - 32px)",
                    }}
                  >
                    Show {olderAlerts.length + archivedAlerts.length} older alerts
                  </button>
                </div>
              ) : null}

              {showArchived && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                  {archivedAlerts.map((alert, i) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      index={i}
                      isUnread={!readAlertIds.has(alert.id)}
                      onRead={handleRead}
                    />
                  ))}
                </div>
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
  const isSafetyCritical = /danger|emergency|evacuation/i.test(alert.category);
  const titleColor = isSafetyCritical ? "#E24B4A" : "#1A2F1E";
  const bodyColor = "rgba(26,47,30,0.65)";
  const metaColor = "rgba(26,47,30,0.40)";

  const [expanded, setExpanded] = useState(false);

  // Rule 1: Show preview only if description is ≥15 chars longer than title
  const desc = alert.description?.replace(/^\d{2}\/\d{2}\/\d{4}\s*/, "") || "";
  const hasSubstantialDesc = desc.length > 0 && (desc.length - alert.title.length) >= 15;

  // Rule 2: Detect if 2-line clamp actually truncates
  const previewRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) { setIsTruncated(false); return; }
    // scrollHeight > clientHeight means line-clamp is cutting content
    setIsTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [desc, hasSubstantialDesc]);

  // Rule 3: External link only if url exists
  const hasUrl = !!alert.url;

  // Rule 2+4: Show chevron only if content is genuinely truncated
  const showChevron = hasSubstantialDesc && isTruncated;

  // Both icons present
  const bothIcons = showChevron && hasUrl;

  const cardStyle: React.CSSProperties = useMemo(() => {
    return config.style ?? {};
  }, [config.style]);

  useEffect(() => {
    if (isSafetyCritical && isUnread) {
      onRead(alert.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    if (!showChevron && !hasSubstantialDesc) return; // nothing to expand
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && isUnread) {
      onRead(alert.id);
    }
  };

  // Icon zone width for text clearance (Rule: text must not underlap icons)
  const iconZoneWidth = bothIcons ? 52 : (showChevron || hasUrl) ? 44 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isUnread ? 1 : 0.7, y: 0 }}
      transition={{ opacity: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }, delay: index * 0.05 }}
      className={`tactile-card rounded-[10px] ${config.className}`}
      style={{ ...cardStyle, padding: "16px", boxShadow: "none", cursor: (showChevron || hasSubstantialDesc) ? "pointer" : "default" }}
      onClick={handleToggle}
      role={(showChevron || hasSubstantialDesc) ? "button" : undefined}
      tabIndex={(showChevron || hasSubstantialDesc) ? 0 : undefined}
      onKeyDown={(showChevron || hasSubstantialDesc) ? (e) => e.key === "Enter" && handleToggle() : undefined}
    >
      <div className="flex-1 min-w-0">
        {config.pill && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {IconComp && <IconComp size={16} color={config.iconColor} className="shrink-0" />}
            <span
              className="inline-block font-body"
              style={{ fontFamily: DM_SANS, fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: config.pill.bg, color: config.pill.color }}
            >
              {config.pill.label}
            </span>
          </div>
        )}

        {/* Title + icon row */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {/* NEW badge */}
          {isUnread && (Date.now() - new Date(alert.last_updated).getTime() < 72 * 60 * 60 * 1000) && (
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "#2F6F4E",
                color: "#FFFFFF",
                padding: "2px 4px",
                borderRadius: 4,
                flexShrink: 0,
                marginRight: 6,
                marginTop: 3,
              }}
            >
              NEW
            </span>
          )}

          {/* Title text — clears icon zone */}
          <span
            className="leading-snug line-clamp-2 font-body flex-1"
            style={{
              fontFamily: DM_SANS,
              fontSize: 14,
              fontWeight: 500,
              color: titleColor,
              paddingRight: iconZoneWidth > 0 ? iconZoneWidth : 0,
            }}
          >
            {alert.title}
          </span>

          {/* Icon zone — absolutely positioned to avoid layout shift */}
          <div style={{ display: "flex", alignItems: "center", gap: bothIcons ? 8 : 0, flexShrink: 0, marginLeft: -(iconZoneWidth), marginTop: -2 }}>
            {hasUrl && (
              <a
                href={alert.url!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <ExternalLink size={11} />
              </a>
            )}
            {showChevron && (
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms ease-out",
                  transformOrigin: "center",
                  backfaceVisibility: "hidden",
                }}
              >
                <ChevronDown size={14} style={{ color: "rgba(28,24,18,0.35)" }} />
              </span>
            )}
          </div>
        </div>

        {/* Preview / expanded description */}
        {hasSubstantialDesc && (
          <div
            style={{
              maxHeight: expanded ? 300 : 42, /* ~2 lines at 13px/1.5 line-height ≈ 39px, round to 42 */
              overflow: "hidden",
              transition: "max-height 200ms ease-out",
            }}
          >
            <p
              ref={expanded ? undefined : previewRef}
              className={`font-normal mt-1 leading-[1.5] font-body ${expanded ? "" : "line-clamp-2"}`}
              style={{
                fontFamily: DM_SANS,
                fontSize: 13,
                color: bodyColor,
                opacity: expanded ? 1 : 1,
                transition: "opacity 200ms ease-out",
              }}
            >
              {desc}
            </p>
            {/* Hidden measure element for truncation detection when expanded */}
            {expanded && (
              <p
                ref={previewRef}
                className="font-normal leading-[1.5] font-body line-clamp-2"
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 13,
                  position: "absolute",
                  visibility: "hidden",
                  pointerEvents: "none",
                  width: previewRef.current?.parentElement?.offsetWidth ?? "100%",
                }}
                aria-hidden
              >
                {desc}
              </p>
            )}
          </div>
        )}

        {/* Posted date — always pinned */}
        <span
          className="font-normal mt-1.5 block font-body"
          style={{ fontFamily: DM_SANS, fontSize: 11, color: metaColor }}
        >
          {config.pill ? "" : `${alert.category} · `}{alert.last_updated ? `Posted ${formatPostedDate(alert.last_updated)}` : ""}
        </span>
      </div>
    </motion.div>
  );
}


/* ── Filter Chip ── */

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const base = "whitespace-nowrap font-body cursor-pointer transition-colors select-none";
  const sizing: React.CSSProperties = {
    fontSize: 13,
    padding: "6px 14px",
    borderRadius: 20,
    minHeight: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: DM_SANS,
  };

  const chipStyle: React.CSSProperties = active
    ? { background: "#2F6F4E", color: "#F0EDEA", border: "1px solid transparent", fontWeight: 500 }
    : { background: "transparent", border: "1px solid rgba(26,47,30,0.20)", color: "rgba(26,47,30,0.70)", fontWeight: 500 };

  return (
    <button onClick={onClick} className={base} style={{ ...sizing, ...chipStyle }}>
      {label}
      {count != null && (
        <span style={{ opacity: 0.7 }}>({count})</span>
      )}
    </button>
  );
}
