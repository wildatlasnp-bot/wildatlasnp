import { useEffect, useState } from "react";

/**
 * PokoSchematic — a technical, horology-grade SVG portrait of Poko.
 *
 * Not a mascot illustration. This reads as a watchmaker's blueprint: a
 * circular bezel with hour-tick gradations, a compass-rose silhouette of
 * Poko's head, registration crosshairs, and (when `live`) a slow radar
 * sweep that completes one full revolution every 6s — the cadence of a
 * quiet, deliberate scan, not a frantic spinner.
 *
 * Sizing is fluid via the `size` prop. Reduced-motion users get a static
 * dial with the sweep frozen at the 12 o'clock position.
 */
export default function PokoSchematic({
  size = 96,
  live = true,
  tone = "dark", // "dark" = on forest bg (cream lines), "light" = on cream bg
  showSweep = true,
}: {
  size?: number;
  live?: boolean;
  tone?: "dark" | "light";
  showSweep?: boolean;
}) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const ink = tone === "dark" ? "rgba(240, 237, 234, 0.78)" : "rgba(26, 47, 30, 0.82)";
  const dim = tone === "dark" ? "rgba(240, 237, 234, 0.32)" : "rgba(26, 47, 30, 0.32)";
  const faint = tone === "dark" ? "rgba(240, 237, 234, 0.14)" : "rgba(26, 47, 30, 0.14)";
  const gold = "#C9A96E";

  // 60 ticks around the bezel; every 5th is taller (chronograph cadence)
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <svg
      role="img"
      aria-label={live ? "Poko on watch" : "Poko at rest"}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
    >
      <defs>
        {/* Radar sweep gradient — gold leading edge that fades to nothing */}
        <linearGradient id="poko-sweep" x1="50%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={gold} stopOpacity="0" />
          <stop offset="60%" stopColor={gold} stopOpacity="0.18" />
          <stop offset="100%" stopColor={gold} stopOpacity="0.55" />
        </linearGradient>
        {/* Subtle inner vignette for the dial */}
        <radialGradient id="poko-dial" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tone === "dark" ? "#0E1F16" : "#EDE6D8"} stopOpacity="0" />
          <stop offset="100%" stopColor={tone === "dark" ? "#0E1F16" : "#D8CFBC"} stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* Outer bezel */}
      <circle cx="50" cy="50" r="48" fill="none" stroke={ink} strokeWidth="0.5" />
      <circle cx="50" cy="50" r="46" fill="url(#poko-dial)" stroke={faint} strokeWidth="0.4" />

      {/* Tick gradations */}
      <g>
        {ticks.map((i) => {
          const angle = (i * 6 - 90) * (Math.PI / 180);
          const isMajor = i % 5 === 0;
          const r1 = 46;
          const r2 = isMajor ? 41.5 : 44;
          const x1 = 50 + Math.cos(angle) * r1;
          const y1 = 50 + Math.sin(angle) * r1;
          const x2 = 50 + Math.cos(angle) * r2;
          const y2 = 50 + Math.sin(angle) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMajor ? ink : dim}
              strokeWidth={isMajor ? 0.7 : 0.4}
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* N marker (gold, signature) */}
      <text
        x="50"
        y="13"
        textAnchor="middle"
        fontFamily="'DM Sans', sans-serif"
        fontSize="4"
        fontWeight="600"
        letterSpacing="0.2"
        fill={gold}
      >
        N
      </text>

      {/* Radar sweep wedge */}
      {showSweep && live && (
        <g
          style={{
            transformOrigin: "50px 50px",
            animation: reduced
              ? "none"
              : "pokoSweep 6s linear infinite",
          }}
        >
          <path
            d="M 50 50 L 50 5 A 45 45 0 0 1 95 50 Z"
            fill="url(#poko-sweep)"
            opacity="0.9"
          />
        </g>
      )}

      {/* Registration crosshairs */}
      <line x1="50" y1="6" x2="50" y2="14" stroke={ink} strokeWidth="0.6" />
      <line x1="50" y1="86" x2="50" y2="94" stroke={ink} strokeWidth="0.6" />
      <line x1="6" y1="50" x2="14" y2="50" stroke={ink} strokeWidth="0.6" />
      <line x1="86" y1="50" x2="94" y2="50" stroke={ink} strokeWidth="0.6" />

      {/* ── Poko schematic silhouette ──
          A bear-head outline rendered as engineering drawing: head circle,
          two ear arcs, snout wedge, and registration eye-dots. */}
      <g stroke={ink} strokeWidth="0.7" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {/* Head */}
        <circle cx="50" cy="54" r="18" />
        {/* Ears */}
        <circle cx="36" cy="40" r="5.5" />
        <circle cx="64" cy="40" r="5.5" />
        {/* Inner ears (technical detail) */}
        <circle cx="36" cy="40" r="2" stroke={dim} />
        <circle cx="64" cy="40" r="2" stroke={dim} />
        {/* Snout */}
        <path d="M 43 60 Q 50 66 57 60 L 56 64 Q 50 68 44 64 Z" />
        {/* Nose */}
        <ellipse cx="50" cy="61" rx="1.6" ry="1.1" fill={ink} stroke="none" />
        {/* Centerline (technical drawing convention) */}
        <line x1="50" y1="36" x2="50" y2="72" stroke={dim} strokeDasharray="0.8 1.2" />
      </g>

      {/* Eyes — small dots that "blink" when live */}
      <circle cx="44" cy="52" r="0.9" fill={ink}>
        {live && !reduced && (
          <animate
            attributeName="opacity"
            values="1;1;0.15;1;1"
            keyTimes="0;0.46;0.5;0.54;1"
            dur="5s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle cx="56" cy="52" r="0.9" fill={ink}>
        {live && !reduced && (
          <animate
            attributeName="opacity"
            values="1;1;0.15;1;1"
            keyTimes="0;0.46;0.5;0.54;1"
            dur="5s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Live status pip at 6 o'clock */}
      {live && (
        <circle cx="50" cy="80" r="1.1" fill={gold}>
          {!reduced && (
            <animate
              attributeName="opacity"
              values="1;0.35;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      )}

      <style>{`
        @keyframes pokoSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
