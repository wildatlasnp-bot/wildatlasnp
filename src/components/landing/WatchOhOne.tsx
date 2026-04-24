import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PARK_COLORS } from "@/lib/parks";

/**
 * WatchOhOne — "Field Notes, inaugural issue" section between The Method
 * and Pricing. Hosts a live ticker of the 3 most recent permit finds via
 * the get_recent_finds_ticker() RPC, with a 60-second client-side cache.
 *
 * No new tables: reads from existing recent_finds. The RPC joins parks
 * for the human name. Empty state shows a single "standing by" line.
 */

interface TickerRow {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
  available_count: number | null;
  park_name: string | null;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: TickerRow[] } | null = null;

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    // Show clock time like "2:14 a.m."
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "p.m." : "a.m.";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function WatchOhOne({ isMobile }: { isMobile: boolean }) {
  const [rows, setRows] = useState<TickerRow[]>(cache?.rows ?? []);
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();

    if (cache && now - cache.at < CACHE_TTL_MS) {
      setRows(cache.rows);
      setLoaded(true);
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc("get_recent_finds_ticker");
      if (cancelled) return;
      const next = !error && data ? (data as TickerRow[]) : [];
      cache = { at: Date.now(), rows: next };
      setRows(next);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isEmpty = loaded && rows.length === 0;

  return (
    <section
      style={{
        background: "#F0EDEA",
        paddingTop: isMobile ? 56 : 88,
        paddingBottom: isMobile ? 48 : 80,
        paddingLeft: isMobile ? 20 : 24,
        paddingRight: isMobile ? 20 : 24,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32,
            fontWeight: 500,
            color: "#1A2F1E",
            margin: 0,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          Watch #001
        </h2>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 17,
            fontStyle: "italic",
            color: "#5F6E58",
            margin: "8px 0 0",
            lineHeight: 1.4,
          }}
        >
          Field Notes, inaugural issue.
        </p>

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            lineHeight: 1.65,
            color: "#3D4F42",
            margin: isMobile ? "24px 0 36px" : "28px 0 44px",
            maxWidth: 620,
          }}
        >
          We launched this watch in April 2026. Every alert we send is logged.
          The next issue reports what we saw, honestly — including the ones we
          missed. Subscribe to Field Notes and you'll get the numbers when they
          exist.
        </p>

        {/* ───── Ticker ───── */}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#7A7A74",
            marginBottom: 14,
          }}
        >
          Last 24 hours
        </div>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            borderTop: "0.5px solid #C9D0C5",
          }}
        >
          {!loaded ? (
            // Skeleton — 3 placeholder rows matching the real row height
            // (12px vertical padding, dot + text), so the section reserves
            // its final height and never jumps when data arrives.
            <>
              <style>{`
                @keyframes watchOhOnePulse {
                  0%, 100% { opacity: 0.55; }
                  50%      { opacity: 1; }
                }
              `}</style>
              {[0, 1, 2].map((i) => (
                <li
                  key={`skeleton-${i}`}
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "0.5px solid #C9D0C5",
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "#C9D0C5",
                      flexShrink: 0,
                      animation: "watchOhOnePulse 1.6s ease-in-out infinite",
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                  <span
                    style={{
                      height: 10,
                      borderRadius: 2,
                      background: "#DCDDD7",
                      // Stagger widths so the skeleton reads as a list
                      // rather than three identical bars.
                      width: i === 0 ? "62%" : i === 1 ? "78%" : "48%",
                      animation: "watchOhOnePulse 1.6s ease-in-out infinite",
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                </li>
              ))}
              <span className="sr-only" role="status" aria-live="polite">
                Loading recent finds…
              </span>
            </>
          ) : isEmpty ? (
            <li
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "0.5px solid #C9D0C5",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: "#1A2F1E",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#A8BDAC",
                  flexShrink: 0,
                }}
              />
              <span>Standing by for launch · April 2026</span>
            </li>
          ) : (
            rows.map((r) => {
              const dot = PARK_COLORS[r.park_id] ?? "#A8BDAC";
              const spots =
                typeof r.available_count === "number" && r.available_count > 0
                  ? `${r.available_count} spot${r.available_count === 1 ? "" : "s"}`
                  : null;
              return (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "0.5px solid #C9D0C5",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: "#1A2F1E",
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: dot,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {r.permit_name}
                    <span style={{ color: "#7A7A74" }}>
                      {" · "}
                      {formatRelative(r.found_at)}
                      {spots ? ` · ${spots}` : ""}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontStyle: "italic",
            fontSize: 12,
            color: "#7A7A74",
            margin: "16px 0 0",
          }}
        >
          Updated every 2 minutes during active sweeps.
        </p>
      </div>
    </section>
  );
}
