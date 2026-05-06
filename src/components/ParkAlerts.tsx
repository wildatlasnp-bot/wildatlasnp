import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { PARKS, getParkColor } from "@/lib/parks";
import { haptics } from "@/lib/haptics";

/* ─────────────────────────────────────────────────────────────────
   FIELD DISPATCH — Park Alerts (full editorial rebuild)
   • Numeral hero (giant Cormorant total)
   • Severity ledger doubles as filter (no chip rail)
   • Ledger-entry alerts: hairlines, mono numerals, no boxes
   • Pure neutral palette — gold accents only
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
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/* Editorial neutral palette */
const INK = "#1C1C1A";
const INK_BODY = "#3A3A36";
const INK_MUTED = "#5C5A55";
const INK_FAINT = "#8A8780";
const CREAM = "#F5F0E8";
const PAPER = "#FFFFFF";
const RULE = "rgba(28,28,26,0.10)";
const RULE_STRONG = "rgba(28,28,26,0.20)";
const GOLD = "#B58A3F";
const GOLD_SOFT = "rgba(181,138,63,0.32)";

/* Severity inks — restrained, no green */
const SEV_INK: Record<Severity, string> = {
  critical: "#8B0000",
  closure:  "#A8421C",
  caution:  "#9C6B14",
  info:     "#2A2A28",
};
const SEV_LABEL: Record<Severity, string> = {
  critical: "Emergency",
  closure:  "Closure",
  caution:  "Caution",
  info:     "Notice",
};
const SEV_RANK: Record<Severity, number> = { critical: 0, closure: 1, caution: 2, info: 3 };
const SEV_ORDER: Severity[] = ["critical", "closure", "caution", "info"];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

function severityOf(category: string): Severity {
  const c = category.toLowerCase();
  if (/danger|emergency|evacuation/.test(c)) return "critical";
  if (/closure/.test(c)) return "closure";
  if (/caution/.test(c)) return "caution";
  return "info";
}

function smartTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const date = new Date(timestamp);
  const days = Math.floor(hours / 24);
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPostedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatEditionDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
}

function sortAlerts(list: ParkAlert[], readIds: Set<string>): ParkAlert[] {
  return [...list].sort((a, b) => {
    const sa = SEV_RANK[severityOf(a.category)];
    const sb = SEV_RANK[severityOf(b.category)];
    const aRead = readIds.has(a.id) ? 1 : 0;
    const bRead = readIds.has(b.id) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    if (sa !== sb) return sa - sb;
    return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
  });
}

/* ═════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════ */

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

  const [activeTypeFilter, setActiveTypeFilter] = useState<Severity | null>(null);
  const [activeParkFilter, setActiveParkFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    if (!lastFetchedAt) return;
    const recalc = () => setMetaTimeLabel(smartTimeAgo(lastFetchedAt));
    recalc();
    const id = setInterval(recalc, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") recalc(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [lastFetchedAt]);

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

  const counts = useMemo(() => {
    const out = { critical: 0, closure: 0, caution: 0, info: 0 };
    for (const a of alerts) out[severityOf(a.category)]++;
    return out;
  }, [alerts]);

  const total = alerts.length;

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
    if (activeTypeFilter) result = result.filter((a) => severityOf(a.category) === activeTypeFilter);
    if (activeParkFilter) result = result.filter((a) => a.park_id === activeParkFilter);
    if (unreadOnly) result = result.filter((a) => !readAlertIds.has(a.id));
    return result;
  }, [alerts, activeTypeFilter, activeParkFilter, unreadOnly, readAlertIds]);

  const unreadCount = useMemo(
    () => alerts.reduce((n, a) => (readAlertIds.has(a.id) ? n : n + 1), 0),
    [alerts, readAlertIds]
  );

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
  const parkCount = trackedParkIds?.size ?? 0;

  const onSeverityToggle = (sev: Severity) => {
    haptics.light();
    setActiveTypeFilter((prev) => (prev === sev ? null : sev));
    setUnreadOnly(false);
  };
  const onUnreadToggle = () => {
    haptics.light();
    setUnreadOnly((v) => !v);
  };
  const onParkToggle = (id: string) => {
    haptics.light();
    setActiveParkFilter((prev) => (prev === id ? null : id));
  };
  const onClearAll = () => {
    setActiveTypeFilter(null);
    setActiveParkFilter(null);
    setUnreadOnly(false);
  };

  const hasFilter = !!activeTypeFilter || !!activeParkFilter || unreadOnly;

  /* ── Loading ── */
  if (loading) {
    return (
      <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
        <NumeralHero loading total={0} parkCount={0} timeLabel={null} onRefresh={() => {}} refreshing={false} />
        <div style={{ padding: "32px 20px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              padding: "18px 0", borderBottom: `1px solid ${RULE}`,
              opacity: 0.55, animation: `dispatch-pulse 1.6s ease-in-out ${i * 120}ms infinite`,
            }}>
              <div style={{ height: 9, width: 80, background: RULE_STRONG, borderRadius: 1, marginBottom: 10 }} />
              <div style={{ height: 22, width: "82%", background: RULE_STRONG, borderRadius: 2, marginBottom: 10 }} />
              <div style={{ height: 11, width: "60%", background: RULE, borderRadius: 1 }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes dispatch-pulse { 0%,100%{opacity:.45} 50%{opacity:.85} } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Empty ── */
  if (alerts.length === 0 && !refreshError) {
    return (
      <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
        <NumeralHero total={0} parkCount={parkCount} timeLabel={metaTimeLabel} onRefresh={handleRefresh} refreshing={refreshing} />
        <QuietTrail timeLabel={metaTimeLabel} />
      </div>
    );
  }

  return (
    <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
      {/* ─── HERO ─── */}
      <NumeralHero
        total={total}
        parkCount={parkCount}
        timeLabel={metaTimeLabel}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ─── SEVERITY LEDGER (filter) ─── */}
      <SeverityLedger
        counts={counts}
        active={activeTypeFilter}
        onToggle={onSeverityToggle}
      />

      {/* ─── SECONDARY FILTERS (Unread + Parks) ─── */}
      {(unreadCount > 0 || parkChips.length > 0 || hasFilter) && (
        <SecondaryFilters
          unreadCount={unreadCount}
          unreadActive={unreadOnly}
          onUnreadToggle={onUnreadToggle}
          parkChips={parkChips}
          activeParkId={activeParkFilter}
          onParkToggle={onParkToggle}
          hasAnyFilter={hasFilter}
          onClear={onClearAll}
        />
      )}

      {/* ── Refresh error ── */}
      <AnimatePresence>
        {refreshError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              margin: "16px 20px 0", padding: "10px 14px", borderRadius: 4,
              background: "rgba(168,66,28,0.05)", border: `1px solid rgba(168,66,28,0.18)`,
              borderLeft: `3px solid ${SEV_INK.closure}`,
              fontFamily: DM, fontSize: 12, color: SEV_INK.closure,
            }}
          >
            {refreshError} — pull to refresh.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LEDGER ENTRIES ─── */}
      <div style={{ padding: "8px 20px 4px" }}>
        {visibleAlerts.length === 0 ? (
          <p style={{
            fontFamily: CG, fontStyle: "italic", fontSize: 18, color: INK_MUTED,
            textAlign: "center", padding: "48px 0", letterSpacing: "0.005em",
          }}>
            Nothing matches that filter.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {(() => {
              // Severity filter active → flat numbered list
              if (activeTypeFilter) {
                return (
                  <div>
                    {visibleAlerts.map((alert, i) => (
                      <LedgerEntry
                        key={alert.id}
                        alert={alert}
                        index={i}
                        seqNumber={i + 1}
                        isFirst={i === 0}
                        isLast={i === visibleAlerts.length - 1}
                        isUnread={!readAlertIds.has(alert.id)}
                        onRead={handleRead}
                      />
                    ))}
                  </div>
                );
              }

              // Otherwise: chapters by severity
              const groups: Record<Severity, ParkAlert[]> = { critical: [], closure: [], caution: [], info: [] };
              for (const a of visibleAlerts) groups[severityOf(a.category)].push(a);
              const ROMAN = ["I", "II", "III", "IV"];
              let chapterIdx = 0;
              let cardIdx = 0;
              const visibleSevs = SEV_ORDER.filter((sev) => groups[sev].length > 0);

              return visibleSevs.map((sev, si) => {
                const numeral = ROMAN[chapterIdx++];
                const list = groups[sev];
                return (
                  <section key={sev} style={{ marginTop: si === 0 ? 12 : 32 }}>
                    <ChapterHead numeral={numeral} label={SEV_LABEL[sev]} count={list.length} ink={SEV_INK[sev]} />
                    <div style={{ marginTop: 4 }}>
                      {list.map((alert, i) => (
                        <LedgerEntry
                          key={alert.id}
                          alert={alert}
                          index={cardIdx}
                          seqNumber={++cardIdx}
                          isFirst={i === 0}
                          isLast={i === list.length - 1}
                          isUnread={!readAlertIds.has(alert.id)}
                          onRead={handleRead}
                        />
                      ))}
                    </div>
                  </section>
                );
              });
            })()}
          </AnimatePresence>
        )}

        {/* Archive toggle */}
        {((!showOlder && olderAlerts.length > 0) || (showOlder && archivedAlerts.length > 0)) && (
          <button
            onClick={() => {
              if (!showOlder && olderAlerts.length > 0) setShowOlder(true);
              else setShowArchived((v) => !v);
            }}
            style={{
              width: "100%", marginTop: 16, padding: "16px",
              background: "transparent", border: "none",
              borderTop: `1px solid ${RULE_STRONG}`,
              fontFamily: DM, fontSize: 11, fontWeight: 500, color: INK_FAINT,
              letterSpacing: "0.20em", textTransform: "uppercase",
              cursor: "pointer", minHeight: 44,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            }}
          >
            <span aria-hidden style={{ color: GOLD, fontFamily: CG, fontSize: 11 }}>◆</span>
            {!showOlder
              ? `Open ${olderAlerts.length} earlier dispatches`
              : showArchived ? "Hide archive" : `Open archive · ${archivedAlerts.length}`}
            <span aria-hidden style={{ color: GOLD, fontFamily: CG, fontSize: 11 }}>◆</span>
          </button>
        )}

        {showArchived && (
          <div style={{ marginTop: 8 }}>
            {archivedAlerts.map((alert, i) => (
              <LedgerEntry
                key={alert.id}
                alert={alert}
                index={i}
                seqNumber={i + 1}
                isFirst={i === 0}
                isLast={i === archivedAlerts.length - 1}
                isUnread={!readAlertIds.has(alert.id)}
                onRead={handleRead}
                archived
              />
            ))}
          </div>
        )}
      </div>

      <Colophon timeLabel={metaTimeLabel} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes tg-shimmer { 0%,100%{opacity:0;transform:translateY(-100%)} 50%{opacity:1;transform:translateY(0%)} }`}</style>
    </div>
  );
});

ParkAlerts.displayName = "ParkAlerts";
export default ParkAlerts;

/* ═════════════════════════════════════════════════════════════════
   NUMERAL HERO — giant total, edition stamp
   ═════════════════════════════════════════════════════════════════ */

function NumeralHero({
  total, parkCount, timeLabel, onRefresh, refreshing, loading,
}: {
  total: number;
  parkCount: number;
  timeLabel: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  loading?: boolean;
}) {
  const edition = formatEditionDate();
  const issueNumber = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, []);

  return (
    <header style={{
      position: "relative",
      background: CREAM,
      padding: "26px 20px 24px",
      borderBottom: `1px solid ${RULE}`,
    }}>
      {/* Edition strip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 11, letterSpacing: "0.20em",
        color: INK_FAINT, textTransform: "uppercase",
      }}>
        <span>Field&nbsp;Dispatch</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>№&nbsp;{String(issueNumber).padStart(3, "0")}</span>
          <button
            onClick={onRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh dispatches"
            style={{
              width: 30, height: 30, padding: 0,
              background: "transparent", border: `1px solid ${RULE_STRONG}`, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: INK_MUTED,
              cursor: refreshing ? "default" : "pointer",
              transition: "background 200ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <RefreshCw size={11} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />
          </button>
        </span>
      </div>

      {/* Numeral hero — total active dispatches as the main subject */}
      <div style={{
        marginTop: 28,
        display: "flex", alignItems: "flex-start", gap: 16,
      }}>
        <div style={{
          fontFamily: CG, fontWeight: 300, fontStyle: "italic",
          fontSize: 124, lineHeight: 0.86, letterSpacing: "-0.04em",
          color: INK,
          fontVariantNumeric: "tabular-nums",
        }}>
          {loading ? "—" : total}
        </div>
        <div style={{ paddingTop: 18 }}>
          <div style={{
            fontFamily: DM, fontSize: 11, fontWeight: 600,
            letterSpacing: "0.24em", textTransform: "uppercase",
            color: INK,
          }}>
            Active
          </div>
          <div style={{
            fontFamily: DM, fontSize: 11, fontWeight: 500,
            letterSpacing: "0.24em", textTransform: "uppercase",
            color: INK_FAINT, marginTop: 3,
          }}>
            Dispatches
          </div>
        </div>
      </div>

      {/* Edition byline */}
      <p style={{
        margin: "20px 0 0",
        fontFamily: CG, fontStyle: "italic", fontSize: 16, fontWeight: 400,
        color: INK_MUTED, lineHeight: 1.4,
      }}>
        {edition === "" ? "Today" : titleCase(edition)} — sourced live from the National Park Service
        {parkCount > 0 ? `, watching ${parkCount} ${parkCount === 1 ? "park" : "parks"}` : ""}.
      </p>

      {/* Mono updated timestamp */}
      <p style={{
        margin: "10px 0 0",
        fontFamily: MONO, fontSize: 11, color: INK_FAINT,
        letterSpacing: "0.10em", textTransform: "uppercase",
      }}>
        {timeLabel ? `Updated ${timeLabel}` : (loading ? "Tuning the wire…" : "Standing by")}
      </p>
    </header>
  );
}

function titleCase(upper: string): string {
  return upper.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ═════════════════════════════════════════════════════════════════
   SEVERITY LEDGER — 4-column tappable filter (replaces chips)
   ═════════════════════════════════════════════════════════════════ */

function SeverityLedger({
  counts, active, onToggle,
}: {
  counts: { critical: number; closure: number; caution: number; info: number };
  active: Severity | null;
  onToggle: (sev: Severity) => void;
}) {
  return (
    <LayoutGroup id="sev-ledger">
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        background: CREAM,
        borderBottom: `1px solid ${RULE}`,
      }}>
        {SEV_ORDER.map((sev, i) => {
          const count = counts[sev];
          const isActive = active === sev;
          const disabled = count === 0;
          return (
            <button
              key={sev}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(sev)}
              aria-pressed={isActive}
              aria-label={`${SEV_LABEL[sev]}: ${count}`}
              style={{
                position: "relative",
                background: "transparent", border: "none",
                padding: "16px 8px 18px",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.32 : 1,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                minHeight: 76,
                borderLeft: i === 0 ? "none" : `1px solid ${RULE}`,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{
                fontFamily: CG, fontWeight: 400,
                fontSize: 28, lineHeight: 1, letterSpacing: "-0.02em",
                color: isActive ? SEV_INK[sev] : INK,
                fontVariantNumeric: "tabular-nums",
                transition: "color 200ms cubic-bezier(0.4,0,0.2,1)",
              }}>
                {count}
              </span>
              <span style={{
                fontFamily: DM, fontSize: 10, fontWeight: 600,
                letterSpacing: "0.20em", textTransform: "uppercase",
                color: isActive ? SEV_INK[sev] : INK_FAINT,
                transition: "color 200ms cubic-bezier(0.4,0,0.2,1)",
              }}>
                {SEV_LABEL[sev]}
              </span>
              {isActive && (
                <motion.span
                  layoutId="ledger-indicator"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  style={{
                    position: "absolute", left: 14, right: 14, bottom: 0, height: 2,
                    background: GOLD, borderRadius: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SECONDARY FILTERS — Unread + Parks + Clear
   ═════════════════════════════════════════════════════════════════ */

function SecondaryFilters({
  unreadCount, unreadActive, onUnreadToggle,
  parkChips, activeParkId, onParkToggle,
  hasAnyFilter, onClear,
}: {
  unreadCount: number;
  unreadActive: boolean;
  onUnreadToggle: () => void;
  parkChips: { id: string; label: string; count: number; color: string }[];
  activeParkId: string | null;
  onParkToggle: (id: string) => void;
  hasAnyFilter: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className="no-scrollbar"
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "10px 20px",
        overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      {unreadCount > 0 && (
        <SecondaryChip
          label="Unread"
          count={unreadCount}
          active={unreadActive}
          onClick={onUnreadToggle}
        />
      )}
      {parkChips.length > 0 && unreadCount > 0 && (
        <span style={{ width: 1, alignSelf: "center", height: 14, background: RULE, margin: "0 6px", flexShrink: 0 }} />
      )}
      {parkChips.map((p) => (
        <SecondaryChip
          key={p.id}
          label={p.label}
          count={p.count}
          active={activeParkId === p.id}
          dot={p.color}
          onClick={() => onParkToggle(p.id)}
        />
      ))}
      <div style={{ flex: 1, minWidth: 8 }} />
      {hasAnyFilter && (
        <button
          onClick={onClear}
          style={{
            background: "transparent", border: "none",
            fontFamily: DM, fontSize: 11, fontWeight: 500,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: GOLD, cursor: "pointer",
            padding: "8px 4px", flexShrink: 0,
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SecondaryChip({
  label, count, active, dot, onClick,
}: {
  label: string; count: number; active: boolean; dot?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(28,28,26,0.04)" : "transparent",
        border: `1px solid ${active ? RULE_STRONG : RULE}`,
        borderRadius: 999,
        padding: "7px 12px",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: DM, fontSize: 12,
        fontWeight: active ? 500 : 400,
        color: active ? INK : INK_MUTED,
        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
        minHeight: 32,
        transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: dot,
          flexShrink: 0,
        }} />
      )}
      <span>{label}</span>
      <span style={{
        fontFamily: MONO, fontSize: 11,
        color: active ? INK : INK_FAINT,
        fontVariantNumeric: "tabular-nums",
      }}>
        {count}
      </span>
    </button>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CHAPTER HEAD — Roman numeral severity divider
   ═════════════════════════════════════════════════════════════════ */

function ChapterHead({ numeral, label, count, ink }: { numeral: string; label: string; count: number; ink: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12,
      paddingTop: 18, paddingBottom: 12,
    }}>
      <span style={{
        fontFamily: CG, fontStyle: "italic", fontWeight: 400,
        fontSize: 14, color: GOLD, letterSpacing: "0.04em",
        minWidth: 22, fontVariantNumeric: "tabular-nums",
      }}>
        {numeral}.
      </span>
      <span style={{
        fontFamily: DM, fontSize: 11, fontWeight: 600,
        letterSpacing: "0.24em", textTransform: "uppercase",
        color: ink,
      }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: RULE, alignSelf: "center" }} />
      <span style={{
        fontFamily: MONO, fontSize: 11, color: INK_FAINT,
        letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums",
      }}>
        {String(count).padStart(2, "0")}
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   LEDGER ENTRY — boxless, hairline-divided alert
   ═════════════════════════════════════════════════════════════════ */

function LedgerEntry({
  alert, isUnread, onRead, index, seqNumber, isFirst, isLast, archived,
}: {
  alert: ParkAlert;
  isUnread: boolean;
  onRead: (id: string) => void;
  index: number;
  seqNumber: number;
  isFirst: boolean;
  isLast: boolean;
  archived?: boolean;
}) {
  const sev = severityOf(alert.category);
  const sevInk = SEV_INK[sev];
  const sevLabel = SEV_LABEL[sev];
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
    haptics.light();
    setExpanded(willExpand);
    if (willExpand && isUnread) onRead(alert.id);
  };

  const isFresh = isUnread && (Date.now() - new Date(alert.last_updated).getTime() < 72 * 60 * 60 * 1000);
  const interactive = showChevron || hasSubstantialDesc;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: archived ? 0.55 : (isUnread ? 1 : 0.78), y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        opacity: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        y: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        delay: Math.min(index * 0.04, 0.3),
        layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      }}
      onClick={handleToggle}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => e.key === "Enter" && handleToggle() : undefined}
      style={{
        position: "relative",
        padding: "20px 0 22px",
        borderTop: isFirst ? "none" : `1px solid ${RULE}`,
        cursor: interactive ? "pointer" : "default",
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        columnGap: 14,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Sequential mono numeral (left gutter) */}
      <div style={{ paddingTop: 4 }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 400,
          color: INK_FAINT, letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}>
          {String(seqNumber).padStart(2, "0")}
        </span>
      </div>

      {/* Body column */}
      <div>
        {/* Top row: severity tag + fresh + timestamp */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span aria-hidden style={{
              width: 4, height: 4, borderRadius: 999, background: sevInk,
              flexShrink: 0,
              boxShadow: sev === "critical" && isUnread ? `0 0 6px ${sevInk}99` : "none",
            }} />
            <span style={{
              fontFamily: DM, fontSize: 11, fontWeight: 600,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: sevInk,
            }}>
              {sevLabel}
            </span>
          </span>
          {isFresh && (
            <span style={{
              fontFamily: DM, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: GOLD,
              padding: "1px 6px", border: `1px solid ${GOLD_SOFT}`, borderRadius: 2,
            }}>
              New
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: MONO, fontSize: 11, color: INK_FAINT,
            letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums",
          }}>
            {smartTimeAgo(new Date(alert.last_updated).getTime())}
          </span>
        </div>

        {/* Title — editorial serif headline */}
        <h3 style={{
          margin: 0,
          fontFamily: CG, fontWeight: 500,
          fontSize: 22, lineHeight: 1.18, letterSpacing: "-0.008em",
          color: INK,
        }}>
          {alert.title}
        </h3>

        {/* Body */}
        {hasSubstantialDesc && (
          <div style={{
            marginTop: 8,
            maxHeight: expanded ? 600 : 44,
            overflow: "hidden",
            transition: "max-height 280ms cubic-bezier(0.4,0,0.2,1)",
          }}>
            {expanded ? (
              <>
                <p style={{
                  fontFamily: DM, fontSize: 14, fontWeight: 400,
                  color: INK_BODY, lineHeight: 1.62,
                  margin: 0,
                }}>
                  {desc}
                </p>
                {hasUrl && (
                  <a
                    href={alert.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: DM, fontSize: 12, fontWeight: 500,
                      letterSpacing: "0.06em",
                      color: INK, textDecoration: "none",
                      borderBottom: `1px solid ${GOLD_SOFT}`,
                      paddingBottom: 1, marginTop: 14,
                    }}
                  >
                    Open on NPS.gov →
                  </a>
                )}
              </>
            ) : (
              <p
                ref={previewRef}
                className="line-clamp-2"
                style={{
                  fontFamily: DM, fontSize: 13, fontWeight: 400,
                  color: INK_MUTED, lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {desc}
              </p>
            )}
          </div>
        )}

        {/* Byline footer */}
        <div style={{
          marginTop: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999, background: parkColor, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: DM, fontSize: 12, fontWeight: 500,
            color: INK_MUTED, letterSpacing: "0.02em",
          }}>
            {parkName}
          </span>
          <span style={{ color: INK_FAINT, fontFamily: DM, fontSize: 12 }}>·</span>
          <span style={{
            fontFamily: MONO, fontSize: 11, color: INK_FAINT, letterSpacing: "0.04em",
          }}>
            {formatPostedDate(alert.last_updated)}
          </span>
          <div style={{ flex: 1 }} />
          {hasUrl && !expanded && (
            <a
              href={alert.url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open on NPS"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 4,
                color: INK_FAINT,
              }}
            >
              <ExternalLink size={13} />
            </a>
          )}
          {showChevron && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, color: INK_FAINT,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 240ms cubic-bezier(0.4,0,0.2,1)",
            }}>
              <ChevronDown size={14} />
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ═════════════════════════════════════════════════════════════════
   QUIET TRAIL — empty state
   ═════════════════════════════════════════════════════════════════ */

function QuietTrail({ timeLabel }: { timeLabel: string | null }) {
  return (
    <div style={{
      padding: "64px 24px 48px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <span style={{ width: 32, height: 1, background: GOLD_SOFT }} />
        <span style={{ color: GOLD, fontFamily: CG, fontSize: 12 }}>◆</span>
        <span style={{ width: 32, height: 1, background: GOLD_SOFT }} />
      </div>
      <p style={{
        fontFamily: CG, fontStyle: "italic", fontSize: 32, fontWeight: 400,
        color: INK, lineHeight: 1.05, margin: 0, letterSpacing: "-0.015em",
      }}>
        All clear.
      </p>
      <p style={{
        fontFamily: DM, fontSize: 13, fontWeight: 400,
        color: INK_MUTED, lineHeight: 1.6, maxWidth: 280, margin: "14px 0 0",
      }}>
        No active dispatches for the parks you watch.
      </p>
      <p style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 400,
        color: INK_FAINT, letterSpacing: "0.10em", textTransform: "uppercase",
        marginTop: 22,
      }}>
        {timeLabel ? `Last checked ${timeLabel}` : "Standing by"}
      </p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   COLOPHON — editorial footer
   ═════════════════════════════════════════════════════════════════ */

function Colophon({ timeLabel }: { timeLabel: string | null }) {
  return (
    <footer style={{
      padding: "36px 20px 28px",
      textAlign: "center",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 14,
      }}>
        <span style={{ width: 36, height: 1, background: GOLD_SOFT }} />
        <span style={{ color: GOLD, fontFamily: CG, fontSize: 11 }}>◆</span>
        <span style={{ width: 36, height: 1, background: GOLD_SOFT }} />
      </div>
      <p style={{
        fontFamily: CG, fontStyle: "italic", fontSize: 14, color: INK_MUTED,
        margin: 0, lineHeight: 1.5,
      }}>
        Sourced live from the National Park Service. Field-checked daily.
      </p>
      {timeLabel && (
        <p style={{
          fontFamily: MONO, fontSize: 11, color: INK_FAINT,
          letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 8,
        }}>
          Updated {timeLabel}
        </p>
      )}
    </footer>
  );
}
