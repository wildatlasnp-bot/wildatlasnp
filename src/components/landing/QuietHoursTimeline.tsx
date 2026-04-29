import { useEffect, useState } from "react";

/**
 * QuietHoursTimeline — a horology-grade 24-hour timeline that visualizes
 * the "Drop Window" between 22:00 and 06:00 local, when Recreation.gov
 * cancellations cluster and Poko is most active.
 *
 * Visual language: watchmaker's tachymeter strip. Hairline rule, hour
 * gradations every two hours, gold band over the quiet window, and a
 * live mono timestamp anchored to the user's local clock. The "now"
 * indicator is a thin vertical needle that walks across the strip in
 * real time (recomputed every 60s).
 *
 * Pro-only: the gold quiet window is the explicit Pro signal — Pro
 * scans every 2 minutes through the quiet hours; Free scans every 5.
 */

const GOLD = "#C9A96E";
const GOLD_SOFT = "rgba(201, 169, 110, 0.18)";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function QuietHoursTimeline({
  tone = "dark",
  compact = false,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const ink = tone === "dark" ? "rgba(240, 237, 234, 0.85)" : "#1A2F1E";
  const dim = tone === "dark" ? "rgba(240, 237, 234, 0.45)" : "rgba(26, 47, 30, 0.55)";
  const faint = tone === "dark" ? "rgba(240, 237, 234, 0.18)" : "rgba(26, 47, 30, 0.18)";
  const rule = tone === "dark" ? "rgba(240, 237, 234, 0.32)" : "rgba(26, 47, 30, 0.28)";

  // Tick the clock every 30s so the "now" needle and timestamp drift live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Map current local time to a 0–1 position on the 24h strip.
  const minutes = now.getHours() * 60 + now.getMinutes();
  const nowPct = minutes / (24 * 60);

  // Quiet window: 22:00 → next-day 06:00. Render as a single band that
  // wraps the right edge, painted as two segments on the strip.
  const quietBands = [
    { start: 0, end: 6 / 24 },      // 00:00 → 06:00
    { start: 22 / 24, end: 1 },     // 22:00 → 24:00
  ];

  const isQuietNow =
    now.getHours() >= 22 || now.getHours() < 6;

  const stripHeight = compact ? 30 : 38;
  const hourLabels = [0, 6, 12, 18, 24];

  const mono = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        color: ink,
        width: "100%",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: dim,
          }}
        >
          The Quiet Hours
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: dim,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 8,
              height: 1.5,
              background: GOLD,
            }}
          />
          <span style={{ color: GOLD, fontWeight: 600 }}>Pro window</span>
        </div>
      </div>

      {/* Strip */}
      <div
        role="img"
        aria-label={`Quiet hours from 10 p.m. to 6 a.m. ${
          isQuietNow ? "Currently inside the Pro scan window." : "Currently outside the Pro scan window."
        }`}
        style={{
          position: "relative",
          width: "100%",
          height: stripHeight,
          borderTop: `1px solid ${rule}`,
          borderBottom: `1px solid ${rule}`,
        }}
      >
        {/* Quiet bands (gold wash) */}
        {quietBands.map((b, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${b.start * 100}%`,
              width: `${(b.end - b.start) * 100}%`,
              background: GOLD_SOFT,
              borderLeft: i === 1 ? `1px solid ${GOLD}` : "none",
              borderRight: i === 0 ? `1px solid ${GOLD}` : "none",
            }}
          />
        ))}

        {/* Hour ticks — every 2h major, every 1h minor */}
        {Array.from({ length: 25 }, (_, h) => {
          const isMajor = h % 6 === 0;
          const isMid = h % 2 === 0;
          if (!isMid) return null;
          return (
            <div
              key={h}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${(h / 24) * 100}%`,
                width: 1,
                background: isMajor ? rule : faint,
                transform: "translateX(-0.5px)",
              }}
            />
          );
        })}

        {/* "Now" needle */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -4,
            bottom: -4,
            left: `${nowPct * 100}%`,
            width: 1.5,
            background: isQuietNow ? GOLD : ink,
            transform: "translateX(-0.75px)",
            boxShadow: isQuietNow
              ? "0 0 8px rgba(201, 169, 110, 0.7)"
              : "none",
            transition: "left 800ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {/* Needle cap */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -7,
            left: `${nowPct * 100}%`,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isQuietNow ? GOLD : ink,
            transform: "translateX(-3px)",
            transition: "left 800ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* Hour labels */}
      <div
        style={{
          position: "relative",
          height: 16,
          marginTop: 6,
        }}
      >
        {hourLabels.map((h) => (
          <span
            key={h}
            style={{
              position: "absolute",
              left: `${(h / 24) * 100}%`,
              transform:
                h === 0 ? "translateX(0)" : h === 24 ? "translateX(-100%)" : "translateX(-50%)",
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.05em",
              color: dim,
            }}
          >
            {pad(h % 24)}:00
          </span>
        ))}
      </div>

      {/* Live status line */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 11,
          letterSpacing: "0.04em",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            color: isQuietNow ? GOLD : ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pad(now.getHours())}:{pad(now.getMinutes())}{" "}
          <span style={{ color: dim }}>local</span>
        </span>
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 13,
            color: isQuietNow ? GOLD : dim,
          }}
        >
          {isQuietNow
            ? "Inside the drop window — Pro scans every 2 min."
            : "Daylight hours — most parks idle."}
        </span>
      </div>
    </div>
  );
}
