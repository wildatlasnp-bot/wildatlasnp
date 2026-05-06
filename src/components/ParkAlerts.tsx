import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { PARKS, getParkColor } from "@/lib/parks";
import { haptics } from "@/lib/haptics";

/* ─────────────────────────────────────────────────────────────────
   FIELD DISPATCH — Park Alerts (editorial redesign)
   Cream masthead, hairline rules, journal-entry cards.
   Quiet Luxury: less chrome, more whitespace, mono on timestamps.
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

/* Editorial neutral palette — green removed, charcoal + gold only */
const INK = "#1C1C1A";
const INK_MUTED = "#5C5A55";
const INK_FAINT = "#8A8780";
const CREAM = "#F5F0E8";
const CREAM_DEEP = "#F0EDEA";
const PAPER = "#FFFFFF";
const RULE = "rgba(28,28,26,0.10)";
const RULE_STRONG = "rgba(28,28,26,0.20)";
const GOLD = "#B58A3F";
const GOLD_SOFT = "rgba(181,138,63,0.32)";

/* Severity colors — restrained editorial; info is now slate ink, not green */
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
  info:     "Dispatch",
};
const SEV_RANK: Record<Severity, number> = { critical: 0, closure: 1, caution: 2, info: 3 };

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

  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
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
      .map((s) => ({ id: s, label: SEV_LABEL[s], count: c[s] }));
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
    if (activeTypeFilter) result = result.filter((a) => severityOf(a.category) === activeTypeFilter);
    if (activeParkFilter) result = result.filter((a) => a.park_id === activeParkFilter);
    if (unreadOnly) result = result.filter((a) => !readAlertIds.has(a.id));
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
  const parkCount = trackedParkIds?.size ?? 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
        <Masthead loading total={0} parkCount={0} timeLabel={null} onRefresh={() => {}} refreshing={false} dominantSev={null} />
        <div style={{ padding: "8px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              padding: "18px 20px", background: PAPER, borderRadius: 8,
              border: `1px solid ${RULE}`,
              opacity: 0.65, animation: `dispatch-pulse 1.6s ease-in-out ${i * 120}ms infinite`,
            }}>
              <div style={{ height: 9, width: 70, background: RULE, borderRadius: 2, marginBottom: 12 }} />
              <div style={{ height: 17, width: "78%", background: RULE_STRONG, borderRadius: 3, marginBottom: 9 }} />
              <div style={{ height: 11, width: "92%", background: RULE, borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes dispatch-pulse { 0%,100%{opacity:.55} 50%{opacity:.85} }`}</style>
      </div>
    );
  }

  /* ── Empty ── */
  if (alerts.length === 0 && !refreshError) {
    return (
      <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
        <Masthead total={0} parkCount={parkCount} timeLabel={metaTimeLabel} onRefresh={handleRefresh} refreshing={refreshing} dominantSev={null} />
        <QuietTrail timeLabel={metaTimeLabel} />
      </div>
    );
  }

  const dominantSev: Severity | null =
    counts.critical ? "critical" :
    counts.closure  ? "closure"  :
    counts.caution  ? "caution"  :
    counts.info     ? "info"     : null;

  return (
    <div ref={ref} style={{ width: "100%", background: CREAM, minHeight: "100vh" }}>
      <Masthead
        total={total}
        parkCount={parkCount}
        timeLabel={metaTimeLabel}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        dominantSev={dominantSev}
        counts={counts}
        onSeveritySelect={(sev) => {
          setActiveTypeFilter((prev) => (prev === sev ? null : sev));
          setUnreadOnly(false);
        }}
      />

      {/* ── Filter rail ── */}
      <LayoutGroup id="dispatch-filters">
        <div
          className="no-scrollbar"
          style={{
            display: "flex", gap: 2,
            padding: "0 20px 6px",
            overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
            borderBottom: `1px solid ${RULE}`,
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
              accent={SEV_INK.info}
              onClick={() => setUnreadOnly((v) => !v)}
            />
          )}
          {typeChips.map((tc) => (
            <RailChip
              key={tc.id}
              label={tc.label}
              count={tc.count}
              active={activeTypeFilter === tc.id}
              accent={SEV_INK[tc.id as Severity]}
              onClick={() => setActiveTypeFilter((p) => (p === tc.id ? null : tc.id))}
            />
          ))}
          {parkChips.length > 0 && typeChips.length > 0 && (
            <div style={{ width: 1, alignSelf: "center", height: 14, background: RULE, margin: "0 6px", flexShrink: 0 }} />
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

      {/* ── Refresh error ── */}
      <AnimatePresence>
        {refreshError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              margin: "14px 20px 0", padding: "10px 14px", borderRadius: 6,
              background: "rgba(192,57,43,0.05)", border: `1px solid rgba(192,57,43,0.20)`,
              borderLeft: `3px solid ${SEV_INK.closure}`,
              fontFamily: DM, fontSize: 12, color: SEV_INK.closure,
            }}
          >
            {refreshError} — pull to refresh.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cards (grouped by severity into chapters when no severity filter) ── */}
      <div style={{ padding: "10px 20px 4px", display: "flex", flexDirection: "column", gap: 0 }}>
        {visibleAlerts.length === 0 && (
          <p style={{ fontFamily: CG, fontStyle: "italic", fontSize: 17, color: INK_MUTED, textAlign: "center", padding: "32px 0", letterSpacing: "0.005em" }}>
            Nothing matches that filter.
          </p>
        )}

        <AnimatePresence initial={false}>
          {(() => {
            // If a severity filter is active, render flat. Otherwise, group into chapters.
            if (activeTypeFilter) {
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
                  {visibleAlerts.map((alert, i) => (
                    <JournalCard
                      key={alert.id}
                      alert={alert}
                      index={i}
                      isUnread={!readAlertIds.has(alert.id)}
                      onRead={handleRead}
                    />
                  ))}
                </div>
              );
            }

            const order: Severity[] = ["critical", "closure", "caution", "info"];
            const groups: Record<Severity, ParkAlert[]> = { critical: [], closure: [], caution: [], info: [] };
            for (const a of visibleAlerts) groups[severityOf(a.category)].push(a);
            const ROMAN = ["I", "II", "III", "IV"];
            let chapterIdx = 0;
            let cardIdx = 0;

            return order
              .filter((sev) => groups[sev].length > 0)
              .map((sev) => {
                const numeral = ROMAN[chapterIdx++];
                return (
                  <section key={sev} style={{ marginTop: chapterIdx === 1 ? 4 : 24 }}>
                    <ChapterHead numeral={numeral} label={SEV_LABEL[sev]} count={groups[sev].length} ink={SEV_INK[sev]} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                      {groups[sev].map((alert) => (
                        <JournalCard
                          key={alert.id}
                          alert={alert}
                          index={cardIdx++}
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

        {/* Archive toggle */}
        {((!showOlder && olderAlerts.length > 0) || (showOlder && archivedAlerts.length > 0)) && (
          <button
            onClick={() => {
              if (!showOlder && olderAlerts.length > 0) setShowOlder(true);
              else setShowArchived((v) => !v);
            }}
            style={{
              marginTop: 6, padding: "13px 16px",
              background: "transparent",
              border: "none",
              borderTop: `1px solid ${RULE}`,
              fontFamily: DM, fontSize: 11, fontWeight: 500, color: INK_FAINT,
              letterSpacing: "0.18em", textTransform: "uppercase",
              cursor: "pointer", minHeight: 44,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {archivedAlerts.map((alert, i) => (
              <JournalCard key={alert.id} alert={alert} index={i} isUnread={!readAlertIds.has(alert.id)} onRead={handleRead} archived />
            ))}
          </div>
        )}
      </div>

      {/* ── Colophon ── */}
      <Colophon timeLabel={metaTimeLabel} />
    </div>
  );
});

ParkAlerts.displayName = "ParkAlerts";
export default ParkAlerts;

/* ═════════════════════════════════════════════════════════════════
   MASTHEAD — editorial cream wordmark with edition stamp
   ═════════════════════════════════════════════════════════════════ */

function Masthead({
  total, parkCount, timeLabel, onRefresh, refreshing, loading, dominantSev, counts, onSeveritySelect,
}: {
  total: number;
  parkCount: number;
  timeLabel: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  loading?: boolean;
  dominantSev: Severity | null;
  counts?: { critical: number; closure: number; caution: number; info: number };
  onSeveritySelect?: (sev: Severity) => void;
}) {
  const edition = formatEditionDate();
  const issueNumber = useMemo(() => {
    // deterministic-ish issue number from day-of-year
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, []);

  return (
    <header style={{
      position: "relative",
      background: CREAM,
      padding: "26px 20px 18px",
      borderBottom: `1px solid ${RULE}`,
    }}>
      {/* Edition strip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 12, letterSpacing: "0.18em",
        color: INK_FAINT, textTransform: "uppercase",
        marginBottom: 14,
      }}>
        <span>Field&nbsp;Dispatch</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>№&nbsp;{String(issueNumber).padStart(3, "0")}</span>
          <button
            onClick={onRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh dispatches"
            style={{
              width: 28, height: 28, padding: 0,
              background: "transparent", border: `1px solid ${RULE_STRONG}`, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: INK_MUTED,
              cursor: refreshing ? "default" : "pointer",
            }}
          >
            <RefreshCw size={11} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />
          </button>
        </span>
      </div>

      {/* Wordmark */}
      <h1 style={{
        margin: 0,
        fontFamily: CG, fontWeight: 400,
        fontSize: 56, lineHeight: 0.95, letterSpacing: "-0.025em",
        color: INK,
      }}>
        Park <span style={{ fontStyle: "italic", color: INK_MUTED, fontWeight: 300 }}>alerts</span>
      </h1>

      {/* Edition date / source line */}
      <p style={{
        margin: "10px 0 0",
        fontFamily: DM, fontSize: 12, fontWeight: 400,
        color: INK_MUTED, letterSpacing: "0.04em",
      }}>
        {edition}
        <span style={{ color: INK_FAINT, padding: "0 8px" }}>·</span>
        Sourced live from the National Park Service
      </p>

      {/* Gold ornament rule */}
      <div style={{
        marginTop: 18, display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, transparent)` }} />
        <span style={{ color: GOLD, fontFamily: CG, fontSize: 11 }}>◆</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, transparent)` }} />
      </div>

      {/* Stats line: total · parks · last update */}
      <div style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 10,
        alignItems: "end",
      }}>
        <Stat numeral={loading ? "—" : String(total)} label="Active" />
        <Stat numeral={parkCount > 0 ? String(parkCount) : "—"} label={parkCount === 1 ? "Park" : "Parks"} />
        <Stat
          numeral={timeLabel ? "·" : "—"}
          label={timeLabel ? `Updated ${timeLabel}` : "Standing by"}
          mono
        />
      </div>

      {/* Highest summary line */}
      {!loading && counts && dominantSev && (
        <button
          type="button"
          onClick={() => onSeveritySelect?.(dominantSev)}
          aria-label={`Filter by ${SEV_LABEL[dominantSev]}`}
          style={{
            marginTop: 16, padding: "10px 0 0", width: "100%",
            background: "transparent", border: "none",
            borderTop: `1px solid ${RULE}`,
            display: "flex", alignItems: "baseline", gap: 8,
            cursor: "pointer", textAlign: "left", minHeight: 32,
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: 999,
            background: SEV_INK[dominantSev], alignSelf: "center", flexShrink: 0,
            boxShadow: `0 0 8px ${SEV_INK[dominantSev]}55`,
          }} />
          <span style={{
            fontFamily: DM, fontSize: 12, fontWeight: 600,
            letterSpacing: "0.20em", textTransform: "uppercase",
            color: SEV_INK[dominantSev],
          }}>
            Highest · {SEV_LABEL[dominantSev]}
          </span>
          <span style={{
            fontFamily: CG, fontStyle: "italic", fontSize: 14,
            color: INK_MUTED, lineHeight: 1.35, flex: 1,
          }}>
            {summaryFor(dominantSev)}
          </span>
          <span aria-hidden style={{ color: INK_FAINT, fontFamily: DM, fontSize: 14 }}>›</span>
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}

function summaryFor(sev: Severity): string {
  switch (sev) {
    case "critical": return "immediate danger reported. Act now.";
    case "closure":  return "trails or roads closed. Plan around them.";
    case "caution":  return "heightened risk. Proceed prepared.";
    case "info":     return "general park notices. Worth a glance.";
  }
}

function Stat({ numeral, label, mono }: { numeral: string; label: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{
        fontFamily: mono ? MONO : CG,
        fontSize: mono ? 16 : 28,
        fontWeight: mono ? 400 : 400,
        lineHeight: 1, color: INK, letterSpacing: mono ? "0.04em" : "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {numeral}
      </span>
      <span style={{
        fontFamily: DM, fontSize: 11, fontWeight: 500,
        letterSpacing: "0.18em", textTransform: "uppercase",
        color: INK_FAINT,
      }}>
        {label}
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   FILTER RAIL CHIP — flat, gold-underline indicator
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
        background: "transparent", border: "none",
        padding: "12px 12px 14px",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: DM, fontSize: 13,
        fontWeight: active ? 500 : 400,
        color: active ? INK : INK_FAINT,
        cursor: "pointer", whiteSpace: "nowrap",
        minHeight: 44,
        transition: "color 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: dot,
          boxShadow: active ? `0 0 6px ${dot}99` : "none",
          flexShrink: 0,
        }} />
      )}
      <span>{label}</span>
      {count != null && (
        <span style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 400,
          color: active ? (accent ?? INK) : INK_FAINT,
          fontVariantNumeric: "tabular-nums",
        }}>
          {count}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="rail-indicator"
          transition={{ type: "spring", stiffness: 480, damping: 36 }}
          style={{
            position: "absolute", left: 8, right: 8, bottom: 2, height: 2,
            background: GOLD, borderRadius: 2,
          }}
        />
      )}
    </button>
  );
}

/* ═════════════════════════════════════════════════════════════════
   JOURNAL CARD — editorial alert entry
   ═════════════════════════════════════════════════════════════════ */

function JournalCard({
  alert, isUnread, onRead, index, archived,
}: {
  alert: ParkAlert; isUnread: boolean; onRead: (id: string) => void; index: number; archived?: boolean;
}) {
  const sev = severityOf(alert.category);
  const sevInk = SEV_INK[sev];
  const sevLabel = SEV_LABEL[sev].toUpperCase();
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
      animate={{ opacity: archived ? 0.55 : (isUnread ? 1 : 0.82), y: 0 }}
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
        background: PAPER,
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid ${sevInk}`,
        borderRadius: 6,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      {/* Critical: faint shimmer on the left edge */}
      {sev === "critical" && isUnread && (
        <span
          aria-hidden
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.6), transparent)",
            animation: "tg-shimmer 2.4s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Header: severity label + posted date (mono) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 16px 0",
      }}>
        <span style={{
          fontFamily: DM, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.22em", color: sevInk,
        }}>
          {sevLabel}
        </span>
        {isFresh && (
          <span style={{
            fontFamily: DM, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: GOLD,
            border: `1px solid ${GOLD_SOFT}`, padding: "1px 6px", borderRadius: 2,
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

      {/* Title — editorial serif */}
      <h3 style={{
        margin: "6px 16px 0",
        fontFamily: CG, fontWeight: 500,
        fontSize: 21, lineHeight: 1.2, letterSpacing: "-0.005em",
        color: INK,
      }}>
        {alert.title}
      </h3>

      {/* Body */}
      {hasSubstantialDesc && (
        <div style={{
          margin: "8px 16px 0",
          maxHeight: expanded ? 600 : 44,
          overflow: "hidden",
          transition: "max-height 280ms cubic-bezier(0.4,0,0.2,1)",
        }}>
          {expanded ? (
            <>
              <p style={{
                fontFamily: DM, fontSize: 14, fontWeight: 400,
                color: "#3D4D3D", lineHeight: 1.62,
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
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontFamily: DM, fontSize: 12, fontWeight: 500,
                    letterSpacing: "0.06em",
                    color: SEV_INK.info, textDecoration: "none",
                    marginTop: 12,
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
                color: INK_MUTED, lineHeight: 1.5,
                margin: 0,
              }}
            >
              {desc}
            </p>
          )}
        </div>
      )}

      {/* Footer: hairline + park byline */}
      <div style={{
        margin: "12px 16px 0",
        paddingTop: 10, paddingBottom: 12,
        borderTop: `1px solid ${RULE}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: parkColor,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: DM, fontSize: 12, fontWeight: 500,
          color: INK_MUTED, letterSpacing: "0.02em",
        }}>
          {parkName}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: INK_FAINT, letterSpacing: "0.04em",
          marginLeft: 4,
        }}>
          · {formatPostedDate(alert.last_updated)}
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

      <style>{`
        @keyframes tg-shimmer {
          0%, 100% { opacity: 0; transform: translateY(-100%); }
          50% { opacity: 1; transform: translateY(0%); }
        }
      `}</style>
    </motion.article>
  );
}

/* ═════════════════════════════════════════════════════════════════
   QUIET TRAIL — empty state
   ═════════════════════════════════════════════════════════════════ */

function QuietTrail({ timeLabel }: { timeLabel: string | null }) {
  return (
    <div style={{
      padding: "56px 24px 40px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 28, height: 1, background: GOLD_SOFT }} />
        <span style={{ color: GOLD, fontFamily: CG, fontSize: 11 }}>◆</span>
        <span style={{ width: 28, height: 1, background: GOLD_SOFT }} />
      </div>
      <p style={{
        fontFamily: CG, fontStyle: "italic", fontSize: 28, fontWeight: 400,
        color: INK, lineHeight: 1.1, margin: 0, letterSpacing: "-0.01em",
      }}>
        All clear.
      </p>
      <p style={{
        fontFamily: DM, fontSize: 13, fontWeight: 400,
        color: INK_MUTED, lineHeight: 1.55, maxWidth: 280, margin: "12px 0 0",
      }}>
        No active dispatches for the parks you watch.
      </p>
      <p style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 400,
        color: INK_FAINT, letterSpacing: "0.10em", textTransform: "uppercase",
        marginTop: 18,
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
      padding: "32px 20px 24px",
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
