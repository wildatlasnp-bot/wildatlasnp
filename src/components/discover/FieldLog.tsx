// "Field Log" — live editorial strip showing real-time park signals.
// 4 rows: last permit found, active watchers, latest NPS alert, forecast freshness.
// Pure data-driven — zero hallucination.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const GOLD = "#C9A96E";
const FOREST = "#1A2F1E";
const MUTED = "#6B6860";

interface FieldLogProps {
  parkId: string;
  onNavigateToSniper?: () => void;
  onNavigateToAlerts?: () => void;
}

interface LogRow {
  label: string;
  value: string;
  detail?: string;
  onClick?: () => void;
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

export default function FieldLog({ parkId, onNavigateToSniper, onNavigateToAlerts }: FieldLogProps) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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
          .select("title, category, last_updated")
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
        result.push({
          label: "Last find",
          value: timeAgo(found),
          detail: findRes.data.permit_name ?? undefined,
          onClick: onNavigateToSniper,
          pulse: recent,
        });
      } else {
        result.push({
          label: "Last find",
          value: "Awaiting",
          detail: "No drops yet today",
        });
      }

      // Row 2: Active watchers (anonymous social proof)
      const watcherCount = watcherRes.count ?? 0;
      if (watcherCount > 0) {
        result.push({
          label: "On watch",
          value: `${watcherCount} permit${watcherCount !== 1 ? "s" : ""}`,
          detail: "Tracked by users right now",
        });
      }

      // Row 3: Latest NPS alert
      if (alertRes.data) {
        result.push({
          label: alertRes.data.category === "Closure" ? "Closure" : "Advisory",
          value: alertRes.data.title.length > 48
            ? alertRes.data.title.slice(0, 45) + "…"
            : alertRes.data.title,
          detail: timeAgo(new Date(alertRes.data.last_updated)),
          onClick: onNavigateToAlerts,
        });
      }

      // Row 4: Scanner heartbeat / freshness
      if (forecastRes.data?.fetched_at) {
        const updated = new Date(forecastRes.data.fetched_at);
        const ageMin = Math.floor((Date.now() - updated.getTime()) / 60_000);
        const fresh = ageMin < 10;
        result.push({
          label: "Scanner",
          value: fresh ? "Live" : `${ageMin}m ago`,
          detail: fresh ? "Polling Recreation.gov" : "Heartbeat delayed",
          pulse: fresh,
        });
      }

      setRows(result);
      setLoading(false);
    };

    fetchAll();

    // Realtime: bump on new finds for this park
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
  }, [parkId, onNavigateToSniper, onNavigateToAlerts]);

  if (loading) {
    return (
      <div style={{ paddingTop: 16, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ height: 1, backgroundColor: GOLD, opacity: 0.35, marginBottom: 10 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 14, backgroundColor: "#ECE7DF", borderRadius: 4, opacity: 0.6 }}
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
      {/* Section eyebrow with gold ornament */}
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <span style={{ width: 24, height: 1, backgroundColor: GOLD, opacity: 0.55 }} />
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 13,
            color: "#7A9B7A",
          }}
        >
          Field log
        </span>
        <span style={{ flex: 1, height: 1, backgroundColor: "#ECE7DF" }} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const Container: any = row.onClick ? "button" : "div";
          return (
            <motion.div
              key={`${row.label}-${idx}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: idx * 0.05, ease: [0.4, 0, 0.2, 1] }}
              style={{
                borderBottom: isLast ? "none" : `1px solid ${GOLD}1A`,
              }}
            >
              <Container
                onClick={row.onClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: row.onClick ? "pointer" : "default",
                  textAlign: "left",
                  minHeight: 44,
                }}
              >
                {/* Left: italic label + pulsing dot */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {row.pulse && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#2F6F4E",
                        flexShrink: 0,
                        animation: "fieldLogPulse 2s cubic-bezier(0.4,0,0.2,1) infinite",
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {!row.pulse && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: MUTED,
                        opacity: 0.35,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                  )}
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

                {/* Right: bold value */}
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: FOREST,
                    letterSpacing: "0.01em",
                    flexShrink: 0,
                    paddingLeft: 12,
                  }}
                >
                  {row.value}
                </span>
              </Container>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
