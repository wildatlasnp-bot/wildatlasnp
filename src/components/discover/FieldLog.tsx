// "Field Log" — live editorial strip showing real-time park signals.
// 4 rows: last permit found, active watchers, latest NPS alert, scanner heartbeat.
// Tap any row to reveal underlying data + last updated time. Pure data-driven; zero hallucination.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { getParkLocation } from "@/lib/discover-utils";

// Modern Ranger tokens — see :root in src/index.css for the source of truth.
const GOLD = "var(--ranger-gold)";
const FOREST = "var(--ranger-ink-warm)";
const MUTED = "var(--ranger-ink-muted)";
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

interface FieldLogProps {
  parkId: string;
  onNavigateToSniper?: () => void;
  onNavigateToAlerts?: () => void;
}

interface DetailLine {
  label: string;
  value: string;
}

interface LogRow {
  key: string;
  label: string;
  value: string;
  detail?: string;
  /** Optional CTA shown inside the expanded panel (replaces the row's bare onClick). */
  cta?: { label: string; onClick: () => void };
  /** Lines rendered inside the expanded panel. */
  details: DetailLine[];
  /** Source timestamp powering this row, for the "Last updated" footer. */
  updatedAt: Date | null;
  pulse?: boolean;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}

function fmtAbsolute(date: Date, tz: string): string {
  // e.g. "Apr 27 · 5:42 PM PDT"
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date).replace(/\u202f/g, " ");
  return `${datePart} · ${timePart}`;
}

export default function FieldLog({ parkId, onNavigateToSniper, onNavigateToAlerts }: FieldLogProps) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const tz = useMemo(() => getParkLocation(parkId).tz, [parkId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpandedKey(null);

    const fetchAll = async () => {
      const [findRes, watcherRes, alertRes, forecastRes] = await Promise.all([
        supabase
          .from("recent_finds")
          .select("permit_name, location_name, found_at")
          .eq("park_id", parkId)
          .order("found_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("scan_targets")
          .select("id", { count: "exact", head: true })
          .eq("park_id", parkId)
          .eq("status", "active"),
        supabase
          .from("park_alerts")
          .select("title, category, last_updated, description")
          .eq("park_id", parkId)
          .order("last_updated", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("permit_cache")
          .select("fetched_at")
          .eq("cache_key", "__scanner_heartbeat__")
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const result: LogRow[] = [];

      // Row 1: Last permit found
      if (findRes.data?.found_at) {
        const found = new Date(findRes.data.found_at);
        const recent = Date.now() - found.getTime() < 60 * 60_000;
        const details: DetailLine[] = [];
        if (findRes.data.permit_name) details.push({ label: "Permit", value: findRes.data.permit_name });
        if (findRes.data.location_name) details.push({ label: "Location", value: findRes.data.location_name });
        details.push({ label: "Found", value: fmtAbsolute(found, tz) });
        result.push({
          key: "find",
          label: "Last find",
          value: timeAgo(found),
          detail: findRes.data.permit_name ?? undefined,
          cta: onNavigateToSniper ? { label: "View finds →", onClick: onNavigateToSniper } : undefined,
          details,
          updatedAt: found,
          pulse: recent,
        });
      } else {
        result.push({
          key: "find",
          label: "Last find",
          value: "Awaiting",
          detail: "No drops yet today",
          details: [
            { label: "Status", value: "No availability detected in this park yet today." },
            { label: "Source", value: "recent_finds (live feed)" },
          ],
          updatedAt: null,
        });
      }

      // Row 2: Active watchers
      const watcherCount = watcherRes.count ?? 0;
      if (watcherCount > 0) {
        result.push({
          key: "watch",
          label: "On watch",
          value: `${watcherCount} permit${watcherCount !== 1 ? "s" : ""}`,
          detail: "Tracked by users right now",
          details: [
            { label: "Active monitors", value: `${watcherCount}` },
            { label: "Source", value: "scan_targets · status = active" },
            { label: "Scope", value: "All users tracking this park" },
          ],
          updatedAt: new Date(),
        });
      }

      // Row 3: Latest NPS alert
      if (alertRes.data) {
        const updated = new Date(alertRes.data.last_updated);
        const desc = (alertRes.data as { description?: string | null }).description ?? null;
        const details: DetailLine[] = [
          { label: "Category", value: alertRes.data.category ?? "Advisory" },
          { label: "Title", value: alertRes.data.title },
        ];
        if (desc && desc.trim().length > 0) {
          const trimmed = desc.length > 220 ? desc.slice(0, 217) + "…" : desc;
          details.push({ label: "Detail", value: trimmed });
        }
        details.push({ label: "Posted", value: fmtAbsolute(updated, tz) });
        result.push({
          key: "alert",
          label: alertRes.data.category === "Closure" ? "Closure" : "Advisory",
          value: alertRes.data.title.length > 48
            ? alertRes.data.title.slice(0, 45) + "…"
            : alertRes.data.title,
          detail: timeAgo(updated),
          cta: onNavigateToAlerts ? { label: "View alerts →", onClick: onNavigateToAlerts } : undefined,
          details,
          updatedAt: updated,
        });
      }

      // Row 4: Scanner heartbeat
      if (forecastRes.data?.fetched_at) {
        const updated = new Date(forecastRes.data.fetched_at);
        const ageMin = Math.floor((Date.now() - updated.getTime()) / 60_000);
        const fresh = ageMin < 10;
        result.push({
          key: "scanner",
          label: "Scanner",
          value: fresh ? "Live" : `${ageMin}m ago`,
          detail: fresh ? "Polling Recreation.gov" : "Heartbeat delayed",
          details: [
            { label: "Status", value: fresh ? "Live · polling normally" : "Heartbeat delayed" },
            { label: "Last poll", value: fmtAbsolute(updated, tz) },
            { label: "Source", value: "Recreation.gov public API" },
          ],
          updatedAt: updated,
          pulse: fresh,
        });
      }

      setRows(result);
      setLoading(false);
    };

    fetchAll();

    const channel = supabase
      .channel(`field-log-${parkId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recent_finds" },
        (payload) => {
          const row = payload.new as { park_id: string };
          if (row.park_id === parkId && !cancelled) fetchAll();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [parkId, onNavigateToSniper, onNavigateToAlerts, tz]);

  if (loading) {
    return (
      <div style={{ paddingTop: 16, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ height: 1, backgroundColor: GOLD, opacity: 0.35, marginBottom: 10 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 14, backgroundColor: "var(--ranger-rule-bone)", borderRadius: "var(--ranger-r-sm)", opacity: 0.6 }}
              className="animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div style={{ paddingTop: 18, paddingLeft: 20, paddingRight: 20 }}>
      {/* Section eyebrow */}
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <span style={{ width: 24, height: 1, backgroundColor: GOLD, opacity: 0.55 }} />
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--ranger-forest-soft)",
          }}
        >
          Field log
        </span>
        <span style={{ flex: 1, height: 1, backgroundColor: "var(--ranger-rule-bone)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const isOpen = expandedKey === row.key;
          const toggle = () => setExpandedKey((k) => (k === row.key ? null : row.key));
          return (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: idx * 0.05, ease: EASE }}
              style={{ borderBottom: isLast && !isOpen ? "none" : "1px solid var(--ranger-rule-soft)" }}
            >
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-controls={`field-log-detail-${row.key}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 44,
                }}
              >
                {/* Left: dot + label + brief detail */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: row.pulse ? "var(--ranger-forest)" : MUTED,
                      opacity: row.pulse ? 1 : 0.35,
                      flexShrink: 0,
                      animation: row.pulse ? "fieldLogPulse 2s cubic-bezier(0.4,0,0.2,1) infinite" : undefined,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: MUTED,
                      width: 70,
                      flexShrink: 0,
                    }}
                  >
                    {row.label}
                  </span>
                  {row.detail && (
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        color: MUTED,
                        opacity: 0.85,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.detail}
                    </span>
                  )}
                </div>

                {/* Right: value + chevron */}
                <div className="flex items-center" style={{ gap: 8, paddingLeft: 12, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      color: FOREST,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {row.value}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      color: MUTED,
                      opacity: 0.55,
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
                    }}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {/* Expanded detail panel */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`field-log-detail-${row.key}`}
                    key="detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        paddingTop: 4,
                        paddingBottom: 14,
                        paddingLeft: 16,
                        paddingRight: 4,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {row.details.map((d, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: "0.16em",
                              textTransform: "uppercase",
                              color: MUTED,
                              opacity: 0.7,
                              width: 70,
                              flexShrink: 0,
                              paddingTop: 1,
                            }}
                          >
                            {d.label}
                          </span>
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 12.5,
                              lineHeight: 1.45,
                              color: FOREST,
                              flex: 1,
                              wordBreak: "break-word",
                            }}
                          >
                            {d.value}
                          </span>
                        </div>
                      ))}

                      {/* Footer: last updated + optional CTA */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: "1px solid var(--ranger-rule-soft)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontStyle: "italic",
                            fontSize: 12,
                            color: MUTED,
                            opacity: 0.85,
                          }}
                        >
                          {row.updatedAt
                            ? `Last updated ${timeAgo(row.updatedAt)}`
                            : "No updates yet"}
                        </span>
                        {row.cta && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              row.cta!.onClick();
                            }}
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--ranger-forest)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              whiteSpace: "nowrap",
                              minHeight: 44,
                            }}
                          >
                            {row.cta.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
