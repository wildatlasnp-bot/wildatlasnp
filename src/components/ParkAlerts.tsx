import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { PARKS, getParkColor } from "@/lib/parks";

/* ─────────────────────────────────────────────────────────────────
   FIELD DISPATCH — Premium Park Alerts
   "An editorial telegram from the backcountry."
   Cinematic dark hero, parchment telegram cards, sliding filter rail.
   ───────────────────────────────────────────────────────────────── */

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

type Severity = "critical" | "caution" | "closure" | "info";

const CG = "'Cormorant Garamond', serif";
const DM = "'DM Sans', sans-serif";

/* ── Severity mapping (from NPS category strings) ── */
function severityOf(category: string): Severity {
  const c = category.toLowerCase();
  if (/danger|emergency|evacuation/.test(c)) return "critical";
  if (/closure/.test(c)) return "closure";
  if (/caution/.test(c)) return "caution";
  return "info";
}

const SEVERITY_META: Record<Severity, { label: string; ink: string; tint: string; ring: string; sigil: string }> = {
  critical: { label: "EMERGENCY",  ink: "#E24B4A", tint: "rgba(226,75,74,0.10)",  ring: "rgba(226,75,74,0.55)",  sigil: "△" },
  closure:  { label: "CLOSURE",    ink: "#8A6B2E", tint: "rgba(201,169,110,0.14)", ring: "rgba(201,169,110,0.60)", sigil: "✕" },
  caution:  { label: "CAUTION",    ink: "#B5830A", tint: "rgba(201,169,110,0.10)", ring: "rgba(201,169,110,0.50)", sigil: "!" },
  info:     { label: "DISPATCH",   ink: "#2F6F4E", tint: "rgba(47,111,78,0.08)",   ring: "rgba(47,111,78,0.45)",   sigil: "i" },
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, closure: 1, caution: 2, info: 3 };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

function smartTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const date = new Date(timestamp);
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPostedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function sortAlerts(list: ParkAlert[], readIds: Set<string>): ParkAlert[] {
  return [...list].sort((a, b) => {
    const sa = SEVERITY_RANK[severityOf(a.category)];
    const sb = SEVERITY_RANK[severityOf(b.category)];
    const aRead = readIds.has(a.id) ? 1 : 0;
    const bRead = readIds.has(b.id) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    if (sa !== sb) return sa - sb;
    return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
  });
}

const ParkAlerts = React.forwardRef<HTMLDivElement, ParkAlertsProps>(({ parkId, trackedParkIds }, ref) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [, forceRender] = useState(0);

  const [metaTimeLabel, setMetaTimeLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!lastFetchedAt) return;
    const recalc = () => setMetaTimeLabel(smartTimeAgo(lastFetchedAt));
    recalc();
    const id = setInterval(recalc, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") recalc(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [lastFetchedAt]);

  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [activeParkFilter, setActiveParkFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

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
    if (parkId) query = query.eq("park_id", parkId);
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
    setShowOlder(false);
    setShowArchived(false);
    setActiveTypeFilter(null);
    setActiveParkFilter(null);
    setUnreadOnly(false);
    Promise.all([
      loadAlerts().catch(() => setRefreshError("Couldn't load")),
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
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const { error } = await supabase.functions.invoke("nps-alerts");
      if (error) throw error;
      await loadAlerts();
    } catch {
      setRefreshError("Couldn't refresh");
    } finally {
      setRefreshing(false);
    }
  };

  /* ── Severity counts (drives the dial) ── */
  const counts = useMemo(() => {
    const out = { critical: 0, closure: 0, caution: 0, info: 0 };
    for (const a of alerts) out[severityOf(a.category)]++;
    return out;
  }, [alerts]);

  const total = alerts.length;
  const dominantSeverity: Severity = useMemo(() => {
    if (counts.critical) return "critical";
    if (counts.closure) return "closure";
    if (counts.caution) return "caution";
    return "info";
  }, [counts]);

  /* ── Filters ── */
  const parkFilteredAlerts = useMemo(() => {
    if (!activeParkFilter) return alerts;
    return alerts.filter((a) => a.park_id === activeParkFilter);
  }, [alerts, activeParkFilter]);

  const typeChips = useMemo(() => {
    const order: Severity[] = ["critical", "closure", "caution", "info"];
    const c: Record<Severity, number> = { critical: 0, closure: 0, caution: 0, info: 0 };
    for (const a of parkFilteredAlerts) c[severityOf(a.category)]++;
    return order
      .filter((s) => c[s] > 0)
      .map((s) => ({ id: s, label: SEVERITY_META[s].label.charAt(0) + SEVERITY_META[s].label.slice(1).toLowerCase(), count: c[s] }));
  }, [parkFilteredAlerts]);

  const parkChips = useMemo(() => {
    const parkIdsInAlerts = new Set(alerts.map((a) => a.park_id));
    const tracked = trackedParkIds ?? new Set<string>();
    return Array.from(tracked)
      .filter((id) => parkIdsInAlerts.has(id))
      .map((id) => ({
        id,
        label: PARKS[id]?.shortName ?? id,
        count: alerts.filter((a) => a.park_id === id).length,
        color: getParkColor(id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [alerts, trackedParkIds]);

  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (activeTypeFilter) {
      result = result.filter((a) => severityOf(a.category) === activeTypeFilter);
    }
    if (activeParkFilter) {
      result = result.filter((a) => a.park_id === activeParkFilter);
    }
    if (unreadOnly) {
      result = result.filter((a) => !readAlertIds.has(a.id));
    }
    return result;
  }, [alerts, activeTypeFilter, activeParkFilter, unreadOnly, readAlertIds]);

  const unreadCount = useMemo(
    () => alerts.reduce((n, a) => (readAlertIds.has(a.id) ? n : n + 1), 0),
    [alerts, readAlertIds]
  );

  const isAllActive = !activeTypeFilter && !activeParkFilter && !unreadOnly;

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

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div ref={ref} style={{ width: "100%" }}>
        <FieldDispatchHero loading counts={counts} total={0} dominantSeverity="info" parkCount={0} timeLabel={null} onRefresh={() => {}} refreshing={false} />
        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="ranger-card" style={{ padding: 16, opacity: 0.6, animation: `dispatch-pulse 1.6s ease-in-out ${i * 120}ms infinite` }}>
              <div style={{ height: 10, width: 80, background: "rgba(0,0,0,0.06)", borderRadius: 4, marginBottom: 10 }} />
              <div style={{ height: 16, width: "70%", background: "rgba(0,0,0,0.08)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 12, width: "90%", background: "rgba(0,0,0,0.05)", borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes dispatch-pulse { 0%,100%{opacity:.55} 50%{opacity:.85} }`}</style>
      </div>
    );
  }

  /* ── Empty state ── */
  if (alerts.length === 0 && !refreshError) {
    return (
      <div ref={ref} style={{ width: "100%" }}>
        <FieldDispatchHero counts={counts} total={0} dominantSeverity="info" parkCount={trackedParkIds?.size ?? 0} timeLabel={metaTimeLabel} onRefresh={handleRefresh} refreshing={refreshing} />
        <QuietTrail />
      </div>
    );
  }

  const hasTrackedParks = trackedParkIds && trackedParkIds.size > 0;
  const parkCount = hasTrackedParks ? trackedParkIds!.size : 0;

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {/* ─── HERO ─── */}
      <FieldDispatchHero
        counts={counts}
        total={total}
        dominantSeverity={dominantSeverity}
        parkCount={parkCount}
        timeLabel={metaTimeLabel}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ─── DISPATCH FEED ─── */}
      <div style={{ background: "linear-gradient(180deg, var(--ranger-paper-cream) 0%, #F2F1ED 80px)", paddingTop: 20, paddingBottom: 4 }}>
        {/* Filter rail */}
        <LayoutGroup id="dispatch-filters">
          <div
            className="no-scrollbar"
            style={{
              display: "flex",
              gap: 4,
              padding: "0 20px 14px",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            <RailChip
              label="All"
              count={total}
              active={isAllActive}
              onClick={() => { setActiveTypeFilter(null); setActiveParkFilter(null); setUnreadOnly(false); }}
            />
            {unreadCount > 0 && (
              <RailChip
                label="Unread"
                count={unreadCount}
                active={unreadOnly}
                accent="#2F6F4E"
                onClick={() => setUnreadOnly((v) => !v)}
              />
            )}
            {typeChips.map((tc) => (
              <RailChip
                key={tc.id}
                label={tc.label}
                count={tc.count}
                active={activeTypeFilter === tc.id}
                accent={SEVERITY_META[tc.id as Severity].ink}
                onClick={() => setActiveTypeFilter((p) => (p === tc.id ? null : tc.id))}
              />
            ))}
            {parkChips.length > 0 && typeChips.length > 0 && (
              <div style={{ width: 1, alignSelf: "center", height: 18, background: "rgba(0,0,0,0.10)", margin: "0 6px", flexShrink: 0 }} />
            )}
            {parkChips.map((p) => (
              <RailChip
                key={p.id}
                label={p.label}
                count={p.count}
                active={activeParkFilter === p.id}
                dot={p.color}
                onClick={() => setActiveParkFilter((prev) => (prev === p.id ? null : p.id))}
              />
            ))}
          </div>
        </LayoutGroup>

        {/* Refresh error banner */}
        <AnimatePresence>
          {refreshError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                margin: "0 20px 12px",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(226,75,74,0.06)",
                border: "1px solid rgba(226,75,74,0.18)",
                fontFamily: DM, fontSize: 12, color: "#A32D2D",
              }}
            >
              {refreshError} — pull to refresh.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleAlerts.length === 0 && (
            <p style={{ fontFamily: CG, fontStyle: "italic", fontSize: 16, color: "var(--ranger-ink-muted)", textAlign: "center", padding: "32px 0" }}>
              Nothing matches that filter.
            </p>
          )}

          <AnimatePresence initial={false}>
            {visibleAlerts.map((alert, i) => (
              <TelegramCard
                key={alert.id}
                alert={alert}
                index={i}
                isUnread={!readAlertIds.has(alert.id)}
                onRead={handleRead}
              />
            ))}
          </AnimatePresence>

          {/* Show older */}
          {((!showOlder && olderAlerts.length > 0) || (showOlder && archivedAlerts.length > 0)) && (
            <button
              onClick={() => {
                if (!showOlder && olderAlerts.length > 0) setShowOlder(true);
                else setShowArchived((v) => !v);
              }}
              className="ranger-card--interactive"
              style={{
                marginTop: 8,
                padding: "13px 16px",
                background: "transparent",
                border: "1px dashed var(--ranger-rule-strong)",
                borderRadius: 12,
                fontFamily: DM, fontSize: 12, fontWeight: 500, color: "var(--ranger-gold-deep)",
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 44,
              }}
            >
              {!showOlder ? `Show ${olderAlerts.length} earlier dispatches` : showArchived ? "Hide archive" : `Open archive (${archivedAlerts.length})`}
            </button>
          )}

          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {archivedAlerts.map((alert, i) => (
                <TelegramCard key={alert.id} alert={alert} index={i} isUnread={!readAlertIds.has(alert.id)} onRead={handleRead} archived />
              ))}
            </div>
          )}
        </div>

        {/* Field log footer */}
        <div style={{ padding: "28px 20px 12px", textAlign: "center" }}>
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--ranger-rule), transparent)", marginBottom: 14 }} />
          <p style={{ fontFamily: CG, fontStyle: "italic", fontSize: 14, color: "var(--ranger-ink-muted)" }}>
            Sourced live from the National Park Service. Field-checked daily.
          </p>
        </div>
      </div>
    </div>
  );
});

ParkAlerts.displayName = "ParkAlerts";
export default ParkAlerts;

/* ═════════════════════════════════════════════════════════════════
   FIELD DISPATCH HERO — dark cinematic header w/ severity dial
   ═════════════════════════════════════════════════════════════════ */

function FieldDispatchHero({
  counts, total, dominantSeverity, parkCount, timeLabel, onRefresh, refreshing, loading,
}: {
  counts: { critical: number; closure: number; caution: number; info: number };
  total: number;
  dominantSeverity: Severity;
  parkCount: number;
  timeLabel: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  loading?: boolean;
}) {
  const ambientHue = SEVERITY_META[dominantSeverity].ring;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(180deg, #0E1A11 0%, #142519 60%, #1A2E1F 100%)",
        padding: "24px 20px 28px",
        overflow: "hidden",
        borderBottom: "1px solid rgba(201,169,110,0.12)",
      }}
    >
      {/* Ambient severity glow */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 380px 220px at 75% 0%, ${ambientHue} 0%, transparent 70%)`,
          opacity: 0.35, pointerEvents: "none",
        }}
      />

      {/* Mountain silhouette ridge */}
      <RidgeSilhouette />

      {/* Header row: kicker + refresh */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ display: "block", width: 18, height: 1, background: "rgba(201,169,110,0.5)" }} />
          <span style={{
            fontFamily: DM, fontSize: 10, fontWeight: 500, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "rgba(201,169,110,0.75)",
          }}>
            Field Dispatch · {today}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing || loading}
          aria-label="Refresh dispatches"
          style={{
            background: "rgba(232,217,181,0.06)",
            border: "1px solid rgba(201,169,110,0.22)",
            borderRadius: 999,
            width: 34, height: 34,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            cursor: refreshing ? "default" : "pointer",
            color: "rgba(232,217,181,0.7)",
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />
        </button>
      </div>

      {/* Headline */}
      <h1 style={{
        fontFamily: CG, fontSize: 56, fontWeight: 300, lineHeight: 0.92,
        margin: "16px 0 0", color: "#F4F0E8", letterSpacing: "-0.02em",
        position: "relative", zIndex: 2,
      }}>
        <span style={{ display: "block" }}>Park</span>
        <span style={{ display: "block", fontStyle: "italic", color: "rgba(244,240,232,0.62)", letterSpacing: "-0.04em" }}>
          alerts.
        </span>
      </h1>

      {/* Subhead */}
      <p style={{
        fontFamily: DM, fontSize: 13, fontWeight: 300, color: "rgba(244,240,232,0.55)",
        marginTop: 10, lineHeight: 1.5, maxWidth: 280, position: "relative", zIndex: 2,
      }}>
        {loading ? "Tuning the wire…" :
          parkCount > 0
            ? <>Live wire from <span style={{ color: "rgba(201,169,110,0.85)" }}>{parkCount} park{parkCount !== 1 ? "s" : ""}</span> you watch{timeLabel ? `. Updated ${timeLabel}.` : "."}</>
            : <>Listening across the National Park Service{timeLabel ? `. Updated ${timeLabel}.` : "."}</>
        }
      </p>

      {/* Severity dial + counts */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22, position: "relative", zIndex: 2 }}>
        <SeverityDial counts={counts} total={total} loading={loading} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <CountRow label="Emergency"  value={counts.critical} ink="#E24B4A" tip="Immediate danger — evacuations, search-and-rescue, or active hazards. Act now." />
          <CountRow label="Closure"    value={counts.closure}  ink="#C9A96E" tip="Trail, road, or area closed by the park. Plan an alternate route." />
          <CountRow label="Caution"    value={counts.caution}  ink="#E0B560" tip="Heightened risk — wildlife activity, weather, or trail conditions. Proceed prepared." />
          <CountRow label="Dispatch"   value={counts.info}     ink="#7FB89A" tip="General park notice — service updates, advisories, and seasonal news." />
        </div>
      </div>

      {/* Live wire ticker */}
      <WireTicker active={!loading && !refreshing} />
    </div>
  );
}

function RidgeSilhouette() {
  return (
    <svg
      aria-hidden
      width="100%"
      height="64"
      viewBox="0 0 400 64"
      preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: -1, zIndex: 1, opacity: 0.55, pointerEvents: "none" }}
    >
      <path
        d="M0,64 L0,42 L40,28 L70,38 L110,18 L150,32 L190,12 L230,30 L270,22 L310,40 L350,26 L400,36 L400,64 Z"
        fill="#0B1A11"
      />
      <path
        d="M0,64 L0,52 L60,44 L100,50 L160,38 L210,46 L270,40 L320,50 L400,44 L400,64 Z"
        fill="#091610"
        opacity="0.85"
      />
    </svg>
  );
}

function SeverityDial({ counts, total, loading }: { counts: { critical: number; closure: number; caution: number; info: number }; total: number; loading?: boolean }) {
  // Three concentric arcs — animated draw
  const SIZE = 92;
  const STROKE = 5;
  const CENTER = SIZE / 2;
  const RINGS = [
    { r: CENTER - STROKE * 0,  count: counts.critical, color: "#E24B4A", track: "rgba(226,75,74,0.10)" },
    { r: CENTER - STROKE * 2.2, count: counts.closure,  color: "#C9A96E", track: "rgba(201,169,110,0.10)" },
    { r: CENTER - STROKE * 4.4, count: counts.caution + counts.info, color: "#7FB89A", track: "rgba(127,184,154,0.10)" },
  ];
  const denom = Math.max(total, 1);

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        {RINGS.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const ratio = loading ? 0 : ring.count / denom;
          return (
            <g key={i}>
              <circle cx={CENTER} cy={CENTER} r={ring.r} fill="none" stroke={ring.track} strokeWidth={STROKE} />
              <motion.circle
                cx={CENTER} cy={CENTER} r={ring.r}
                fill="none" stroke={ring.color} strokeWidth={STROKE} strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${circ * ratio} ${circ}` }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            </g>
          );
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", pointerEvents: "none",
      }}>
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          style={{ fontFamily: CG, fontSize: 32, fontWeight: 300, color: "#F4F0E8", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          {total}
        </motion.span>
        <span style={{
          fontFamily: DM, fontSize: 8.5, fontWeight: 500, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(244,240,232,0.45)", marginTop: 3,
        }}>
          ACTIVE
        </span>
      </div>
    </div>
  );
}

function CountRow({ label, value, ink, tip }: { label: string; value: number; ink: string; tip?: string }) {
  const isZero = value === 0;
  const [open, setOpen] = useState(false);
  return (
    <div
      role={tip ? "button" : undefined}
      tabIndex={tip ? 0 : undefined}
      aria-label={tip ? `${label} — ${tip}` : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 8,
        opacity: isZero ? 0.32 : 1,
        cursor: tip ? "help" : "default",
        outline: "none",
        minHeight: 18,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: ink,
        boxShadow: isZero ? "none" : `0 0 8px ${ink}66`,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: DM, fontSize: 11, fontWeight: 400,
        color: "rgba(244,240,232,0.78)", letterSpacing: "0.02em", flex: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: CG, fontSize: 16, fontWeight: 400,
        color: "#F4F0E8", fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>

      <AnimatePresence>
        {tip && open && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 5,
              maxWidth: 240,
              padding: "9px 12px",
              background: "rgba(11,22,16,0.96)",
              border: `1px solid ${ink}55`,
              borderLeft: `2px solid ${ink}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              fontFamily: DM, fontSize: 11.5, fontWeight: 300,
              lineHeight: 1.45,
              color: "rgba(244,240,232,0.85)",
              pointerEvents: "none",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <div style={{
              fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.16em",
              textTransform: "uppercase", color: ink, marginBottom: 4,
            }}>
              {label}
            </div>
            {tip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WireTicker({ active }: { active: boolean }) {
  return (
    <div style={{
      position: "relative", marginTop: 22, height: 18,
      display: "flex", alignItems: "center", gap: 10, zIndex: 2,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: "#7FB89A",
        boxShadow: "0 0 10px rgba(127,184,154,0.7)",
        animation: active ? "wire-pulse 1.6s ease-in-out infinite" : undefined,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 400,
        letterSpacing: "0.18em", color: "rgba(127,184,154,0.62)", textTransform: "uppercase",
      }}>
        {active ? "WIRE OPEN · LISTENING" : "WIRE QUIET"}
      </span>
      <div style={{ flex: 1, position: "relative", height: 1, overflow: "hidden", marginLeft: 4 }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, transparent, rgba(201,169,110,0.35), transparent)",
          animation: active ? "wire-sweep 3.2s linear infinite" : undefined,
        }} />
      </div>
      <style>{`
        @keyframes wire-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes wire-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   FILTER RAIL CHIP — shared layoutId underline indicator
   ═════════════════════════════════════════════════════════════════ */

function RailChip({
  label, count, active, accent, dot, onClick,
}: {
  label: string; count?: number; active: boolean;
  accent?: string; dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: "transparent", border: "none", padding: "10px 12px 12px",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: DM, fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? "var(--ranger-ink)" : "var(--ranger-ink-muted)",
        cursor: "pointer", whiteSpace: "nowrap",
        minHeight: 44,
        transition: "color 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {dot && (
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: dot,
          boxShadow: active ? `0 0 6px ${dot}99` : "none",
          flexShrink: 0,
        }} />
      )}
      <span>{label}</span>
      {count != null && (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          opacity: 0.55, fontVariantNumeric: "tabular-nums",
        }}>
          {count}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="rail-indicator"
          transition={{ type: "spring", stiffness: 480, damping: 36 }}
          style={{
            position: "absolute", left: 8, right: 8, bottom: 4, height: 2,
            background: accent ?? "var(--ranger-gold)",
            borderRadius: 2,
          }}
        />
      )}
    </button>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TELEGRAM CARD — editorial alert card
   ═════════════════════════════════════════════════════════════════ */

function TelegramCard({
  alert, isUnread, onRead, index, archived,
}: {
  alert: ParkAlert; isUnread: boolean; onRead: (id: string) => void; index: number; archived?: boolean;
}) {
  const sev = severityOf(alert.category);
  const meta = SEVERITY_META[sev];
  const parkColor = getParkColor(alert.park_id);
  const parkName = PARKS[alert.park_id]?.shortName ?? alert.park_id;

  const [expanded, setExpanded] = useState(false);

  const desc = alert.description?.replace(/^\d{2}\/\d{2}\/\d{4}\s*/, "") || "";
  const hasSubstantialDesc = desc.length > 0 && (desc.length - alert.title.length) >= 15;

  const previewRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) { setIsTruncated(false); return; }
    setIsTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [desc, hasSubstantialDesc]);

  const hasUrl = !!alert.url;
  const showChevron = hasSubstantialDesc && isTruncated;

  useEffect(() => {
    if (sev === "critical" && isUnread) onRead(alert.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    if (!showChevron && !hasSubstantialDesc) return;
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && isUnread) onRead(alert.id);
  };

  const isFresh = isUnread && (Date.now() - new Date(alert.last_updated).getTime() < 72 * 60 * 60 * 1000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: archived ? 0.55 : (isUnread ? 1 : 0.78), y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        opacity: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        y: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        delay: Math.min(index * 0.04, 0.32),
        layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      }}
      onClick={handleToggle}
      role={(showChevron || hasSubstantialDesc) ? "button" : undefined}
      tabIndex={(showChevron || hasSubstantialDesc) ? 0 : undefined}
      onKeyDown={(showChevron || hasSubstantialDesc) ? (e) => e.key === "Enter" && handleToggle() : undefined}
      style={{
        position: "relative",
        background: "var(--ranger-paper)",
        border: "1px solid var(--ranger-rule-onlight)",
        borderRadius: 12,
        padding: "16px 16px 14px 18px",
        boxShadow: sev === "critical" ? "0 6px 22px rgba(226,75,74,0.10)" : "var(--ranger-shadow-2)",
        cursor: (showChevron || hasSubstantialDesc) ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Severity bar (left edge) */}
      <span
        aria-hidden
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: meta.ink,
          opacity: sev === "critical" ? 1 : 0.85,
        }}
      />
      {/* Critical: animated shimmer overlay on the bar */}
      {sev === "critical" && isUnread && (
        <span
          aria-hidden
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.6), transparent)",
            animation: "tg-shimmer 2.4s ease-in-out infinite",
          }}
        />
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {/* Sigil tile */}
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: meta.tint,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: CG, fontSize: 14, fontWeight: 600, color: meta.ink,
          flexShrink: 0,
        }}>
          {meta.sigil}
        </span>
        <span style={{
          fontFamily: DM, fontSize: 9.5, fontWeight: 600,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: meta.ink,
        }}>
          {meta.label}
        </span>
        {isFresh && (
          <span style={{
            fontFamily: DM, fontSize: 8.5, fontWeight: 700,
            letterSpacing: "0.10em", textTransform: "uppercase",
            background: "var(--ranger-forest)", color: "#F4F0E8",
            padding: "2px 6px", borderRadius: 3,
          }}>
            NEW
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: DM, fontSize: 10.5, color: "var(--ranger-ink-faint)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {smartTimeAgo(new Date(alert.last_updated).getTime())}
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: CG, fontSize: 19, fontWeight: 500,
        color: sev === "critical" ? "#A32D2D" : "var(--ranger-ink)",
        lineHeight: 1.18, letterSpacing: "-0.005em",
        marginBottom: hasSubstantialDesc ? 6 : 8,
      }}>
        {alert.title}
      </h3>

      {/* Body */}
      {hasSubstantialDesc && (
        <div style={{
          maxHeight: expanded ? 600 : 42,
          overflow: "hidden",
          transition: "max-height 280ms cubic-bezier(0.4,0,0.2,1)",
        }}>
          <p
            ref={expanded ? undefined : previewRef}
            className={expanded ? "" : "line-clamp-2"}
            style={{
              fontFamily: DM, fontSize: 13, fontWeight: 300,
              color: "var(--ranger-ink-body)", lineHeight: 1.55,
              marginBottom: 8,
            }}
          >
            {desc}
          </p>
        </div>
      )}

      {/* Footer hairline */}
      <div style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--ranger-rule-onlight)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: parkColor,
          boxShadow: `0 0 6px ${parkColor}55`,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: DM, fontSize: 11, fontWeight: 500,
          color: "var(--ranger-ink-muted)", letterSpacing: "0.02em",
        }}>
          {parkName}
        </span>
        <span style={{ fontFamily: DM, fontSize: 11, color: "var(--ranger-ink-faint)" }}>·</span>
        <span style={{ fontFamily: DM, fontSize: 11, color: "var(--ranger-ink-faint)" }}>
          {formatPostedDate(alert.last_updated)}
        </span>
        <div style={{ flex: 1 }} />
        {hasUrl && (
          <a
            href={alert.url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open on NPS"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6,
              color: "var(--ranger-ink-muted)",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <ExternalLink size={12} />
          </a>
        )}
        {showChevron && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28,
            color: "var(--ranger-ink-faint)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 240ms cubic-bezier(0.4,0,0.2,1)",
          }}>
            <ChevronDown size={14} />
          </span>
        )}
      </div>

      <style>{`
        @keyframes tg-shimmer {
          0%, 100% { opacity: 0; transform: translateY(-100%); }
          50% { opacity: 1; transform: translateY(0%); }
        }
      `}</style>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   QUIET TRAIL — empty state
   ═════════════════════════════════════════════════════════════════ */

function QuietTrail() {
  return (
    <div style={{
      background: "linear-gradient(180deg, var(--ranger-paper-cream) 0%, #F2F1ED 80px)",
      padding: "44px 24px 56px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ position: "relative", marginBottom: 18 }}
      >
        <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
          <path d="M0,80 L0,52 L20,40 L36,46 L52,28 L70,42 L88,32 L106,44 L120,38 L120,80 Z" fill="#1A2E1F" opacity="0.85" />
          <path d="M0,80 L0,64 L26,58 L48,62 L72,54 L96,60 L120,56 L120,80 Z" fill="#0E1A11" />
          <circle cx="92" cy="14" r="6" fill="#E8D9B5" opacity="0.85" />
        </svg>
      </motion.div>
      <p style={{
        fontFamily: CG, fontStyle: "italic", fontSize: 22, fontWeight: 400,
        color: "var(--ranger-ink)", lineHeight: 1.25, maxWidth: 280, marginBottom: 8,
      }}>
        The trail is quiet.
      </p>
      <p style={{
        fontFamily: DM, fontSize: 13, fontWeight: 300,
        color: "var(--ranger-ink-muted)", lineHeight: 1.55, maxWidth: 260,
      }}>
        No active dispatches for the parks you watch. We'll send word the moment something changes.
      </p>
    </div>
  );
}
