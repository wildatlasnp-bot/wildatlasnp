/**
 * PokoMapCard — inline, app-palette topographic map snippet for the Poko
 * chat. Pure SVG (no tiles, no satellite imagery): hand-styled contour
 * curves, a river thread, optional dashed trail, and a target dot in
 * "Poko Orange" with a soft pulse. A miniature compass rose at the
 * top-right echoes the cartographer masthead.
 *
 * Data shape (rendered from a ```map JSON block in assistant content):
 * {
 *   "title": "North of trailhead",
 *   "subtitle": "Half Dome cables",
 *   "bearing": "NNE 0.4 mi",         // optional plain-language hint
 *   "target": { "x": 0.62, "y": 0.34 } // 0..1 normalized in card
 * }
 *
 * No real coordinates are required — this is a *visual* aid that
 * removes cognitive load from textual directions, never a navigation
 * source. The card is decorative + informational.
 */
import { forwardRef, useId } from "react";

export interface MapData {
  title?: string;
  subtitle?: string;
  bearing?: string;
  /** Normalized target position in the 16:9 frame (0..1). Default: 0.62, 0.42 */
  target?: { x?: number; y?: number };
  /** Optional dashed trail anchor — start point (0..1). Default: 0.18, 0.78 */
  trailFrom?: { x?: number; y?: number };
}

/* Parser — same shape as parseTrailBlocks, recognises ```map fences. */
export type ChatBlock =
  | { type: "text"; value: string }
  | { type: "map"; value: MapData };

export function parseMapBlocks(content: string): ChatBlock[] {
  const parts: ChatBlock[] = [];
  const regex = /```map\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    try {
      const parsed = JSON.parse(match[1]);
      parts.push({ type: "map", value: parsed as MapData });
    } catch {
      parts.push({ type: "text", value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}

/* ── palette (matches Poko chat surfaces + masthead) ── */
const PAPER_DARK = "#0B2B1B";   // forest paper base
const PAPER_TINT = "#0F3322";   // subtle mid layer
const CREAM = "#F0EDEA";        // cream lines
const CREAM_FAINT = "rgba(240,237,234,0.18)";
const CREAM_RULE = "rgba(240,237,234,0.32)";
const GOLD = "#C9A96E";         // burnished gold (Pro / accent)
const POKO_ORANGE = "#E8762C";  // target signal — distinct from gold

/* Deterministic-looking contour line generator — these look hand-drawn
   but are computed from sin/cos so the layout is stable per render. */
const contour = (cy: number, ampX: number, ampY: number, phase: number): string => {
  const W = 480;
  const steps = 24;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * W;
    const y =
      cy +
      Math.sin(t * Math.PI * 2 + phase) * ampY +
      Math.cos(t * Math.PI * 4 + phase * 1.7) * (ampY * 0.35) +
      Math.sin(t * Math.PI * 6 + phase) * (ampY * 0.18);
    // X jitter so contours feel like elevation lines not sine waves
    const xj = x + Math.sin(t * Math.PI * 3 + phase * 2) * ampX;
    d += i === 0 ? `M ${xj.toFixed(1)} ${y.toFixed(1)} ` : `L ${xj.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
};

const PokoMapCard = forwardRef<HTMLDivElement, { map: MapData }>(({ map }, ref) => {
  const uid = useId().replace(/:/g, "");
  const tx = Math.min(0.9, Math.max(0.1, map.target?.x ?? 0.62));
  const ty = Math.min(0.9, Math.max(0.1, map.target?.y ?? 0.42));
  const fx = Math.min(0.9, Math.max(0.1, map.trailFrom?.x ?? 0.18));
  const fy = Math.min(0.9, Math.max(0.1, map.trailFrom?.y ?? 0.78));

  // 16:9 viewBox, 480 wide for nice pixel math on contours
  const W = 480;
  const H = 270;
  const targetX = tx * W;
  const targetY = ty * H;
  const fromX = fx * W;
  const fromY = fy * H;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={
        map.title
          ? `Map snippet — ${map.title}${map.subtitle ? `, ${map.subtitle}` : ""}`
          : "Map snippet"
      }
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        background: PAPER_DARK,
        border: "1px solid rgba(201,169,110,0.32)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(240,237,234,0.04)",
      }}
    >
      <style>{`
        @keyframes pokoMapTargetPulse {
          0%, 100% { transform: scale(1);   opacity: 0.6; }
          50%      { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes pokoMapTargetCore {
          0%, 100% { transform: scale(1);   }
          50%      { transform: scale(1.08);}
        }
        .poko-map-pulse-${uid} { transform-origin: center; transform-box: fill-box;
          animation: pokoMapTargetPulse 2400ms cubic-bezier(0.4,0,0.2,1) infinite; }
        .poko-map-core-${uid}  { transform-origin: center; transform-box: fill-box;
          animation: pokoMapTargetCore 2400ms cubic-bezier(0.4,0,0.2,1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .poko-map-pulse-${uid}, .poko-map-core-${uid} { animation: none; }
        }
      `}</style>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
        aria-hidden="true"
      >
        <defs>
          {/* Paper gradient — subtle warmth toward the bottom */}
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PAPER_DARK} />
            <stop offset="100%" stopColor={PAPER_TINT} />
          </linearGradient>
          {/* Vignette to anchor the target visually */}
          <radialGradient id={`vig-${uid}`} cx="50%" cy="55%" r="65%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
          </radialGradient>
          {/* Clip paths so contours never bleed past the card */}
          <clipPath id={`clip-${uid}`}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>

        {/* Base paper */}
        <rect x="0" y="0" width={W} height={H} fill={`url(#bg-${uid})`} />

        {/* Topographic contours — thin cream lines, varying opacity for
            the look of layered elevation. Drawn under a clip path so
            they hug the frame perfectly. */}
        <g clipPath={`url(#clip-${uid})`}>
          {[
            { cy: 70,  ax: 6,  ay: 12, ph: 0.0,  o: 0.30 },
            { cy: 95,  ax: 4,  ay: 14, ph: 0.7,  o: 0.24 },
            { cy: 120, ax: 5,  ay: 10, ph: 1.6,  o: 0.20 },
            { cy: 145, ax: 7,  ay: 14, ph: 2.2,  o: 0.30 },
            { cy: 170, ax: 5,  ay: 12, ph: 3.0,  o: 0.22 },
            { cy: 195, ax: 4,  ay: 10, ph: 3.8,  o: 0.18 },
            { cy: 220, ax: 6,  ay: 13, ph: 4.6,  o: 0.26 },
            { cy: 245, ax: 5,  ay: 11, ph: 5.4,  o: 0.20 },
          ].map((c, i) => (
            <path
              key={i}
              d={contour(c.cy, c.ax, c.ay, c.ph)}
              fill="none"
              stroke={CREAM}
              strokeOpacity={c.o}
              strokeWidth={i % 3 === 0 ? 0.8 : 0.55}
            />
          ))}

          {/* River — single sinuous gold-tinted thread (cream actually, the
              gold is reserved for accents). */}
          <path
            d={`M ${0} ${H * 0.62}
                C ${W * 0.18} ${H * 0.50}, ${W * 0.30} ${H * 0.78}, ${W * 0.45} ${H * 0.62}
                S ${W * 0.78} ${H * 0.42}, ${W} ${H * 0.55}`}
            fill="none"
            stroke={CREAM}
            strokeOpacity="0.55"
            strokeWidth="1.1"
            strokeLinecap="round"
          />

          {/* Trail — dashed cream from `from` to `target`, gently curved. */}
          <path
            d={`M ${fromX} ${fromY}
                Q ${(fromX + targetX) / 2} ${(fromY + targetY) / 2 - 24},
                  ${targetX} ${targetY}`}
            fill="none"
            stroke={CREAM}
            strokeOpacity="0.7"
            strokeWidth="1.2"
            strokeDasharray="4 5"
            strokeLinecap="round"
          />

          {/* Trailhead marker — small open ring */}
          <circle cx={fromX} cy={fromY} r="3.4" fill="none" stroke={CREAM} strokeOpacity="0.78" strokeWidth="0.9" />
          <line x1={fromX - 5} y1={fromY} x2={fromX + 5} y2={fromY} stroke={CREAM} strokeOpacity="0.4" strokeWidth="0.6" />
          <line x1={fromX} y1={fromY - 5} x2={fromX} y2={fromY + 5} stroke={CREAM} strokeOpacity="0.4" strokeWidth="0.6" />
        </g>

        {/* Vignette over contours to focus the eye on the target */}
        <rect x="0" y="0" width={W} height={H} fill={`url(#vig-${uid})`} pointerEvents="none" />

        {/* Compass rose — top-right corner, mirrors the masthead language:
            outer hairline ring + cardinal letters + needle (gold N / cream S). */}
        <g transform={`translate(${W - 36}, 28)`}>
          <circle r="18" fill="rgba(11,43,27,0.6)" stroke={CREAM_RULE} strokeWidth="0.6" />
          <circle r="14" fill="none" stroke="rgba(201,169,110,0.45)" strokeWidth="0.4" />
          {/* Cardinal ticks (24-hour bezel feel, 4 visible) */}
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1="0" y1="-18" x2="0" y2="-15"
              stroke={CREAM} strokeOpacity="0.7" strokeWidth="0.7"
              transform={`rotate(${deg})`}
            />
          ))}
          {/* Cardinal letters — italic Cormorant for masthead parity */}
          {[
            { l: "N", x: 0, y: -8 },
            { l: "E", x: 8, y: 1.5 },
            { l: "S", x: 0, y: 11 },
            { l: "W", x: -8, y: 1.5 },
          ].map((c) => (
            <text
              key={c.l}
              x={c.x} y={c.y}
              textAnchor="middle"
              fontFamily="'Cormorant Garamond', serif"
              fontStyle="italic"
              fontSize="6.5"
              fill="rgba(201,169,110,0.85)"
            >{c.l}</text>
          ))}
          {/* Needle — gold north half, cream south half */}
          <polygon points="0,-12 2.2,0 0,12 -2.2,0" fill={GOLD} opacity="0.95"
            style={{ clipPath: "inset(0 0 50% 0)" }} />
          <polygon points="0,-12 2.2,0 0,12 -2.2,0" fill={CREAM} opacity="0.78"
            style={{ clipPath: "inset(50% 0 0 0)" }} />
          <circle r="1.2" fill={CREAM} />
        </g>

        {/* Scale bar — bottom-left, monospace label */}
        <g transform={`translate(16, ${H - 18})`}>
          <line x1="0" y1="0" x2="48" y2="0" stroke={CREAM} strokeOpacity="0.55" strokeWidth="1" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={CREAM} strokeOpacity="0.55" strokeWidth="1" />
          <line x1="24" y1="-2" x2="24" y2="2" stroke={CREAM} strokeOpacity="0.4" strokeWidth="0.7" />
          <line x1="48" y1="-3" x2="48" y2="3" stroke={CREAM} strokeOpacity="0.55" strokeWidth="1" />
          <text x="0" y="-7" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="7" fill="rgba(240,237,234,0.55)" letterSpacing="0.08em">¼ MI</text>
        </g>

        {/* Target — pulsing ring + solid Poko Orange dot. The ring sits
            UNDER the dot so the dot remains crisp at all times. */}
        <g>
          <circle
            cx={targetX} cy={targetY} r="6"
            fill={POKO_ORANGE} fillOpacity="0.55"
            className={`poko-map-pulse-${uid}`}
          />
          <circle
            cx={targetX} cy={targetY} r="4.2"
            fill={POKO_ORANGE}
            stroke={CREAM} strokeWidth="1.2"
            className={`poko-map-core-${uid}`}
          />
        </g>

        {/* Crosshairs through the target — very faint, full bleed */}
        <line x1="0" y1={targetY} x2={W} y2={targetY}
          stroke={POKO_ORANGE} strokeOpacity="0.18" strokeWidth="0.5" strokeDasharray="2 6" />
        <line x1={targetX} y1="0" x2={targetX} y2={H}
          stroke={POKO_ORANGE} strokeOpacity="0.18" strokeWidth="0.5" strokeDasharray="2 6" />

        {/* Border ruling — thin frame inside the card edge */}
        <rect x="4" y="4" width={W - 8} height={H - 8} fill="none"
          stroke={CREAM_FAINT} strokeWidth="0.6" rx="4" />
      </svg>

      {/* Caption row — title (serif) + bearing (mono). Sits inside the
          card on a translucent paper plate so the imagery still breathes. */}
      {(map.title || map.subtitle || map.bearing) && (
        <div
          style={{
            position: "absolute",
            left: 12, right: 12, bottom: 10,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            padding: "8px 10px",
            borderRadius: 6,
            background: "rgba(11,43,27,0.62)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(240,237,234,0.10)",
            pointerEvents: "none",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {map.title && (
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  lineHeight: 1.15,
                  color: "rgba(240,237,234,0.95)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {map.title}
              </div>
            )}
            {map.subtitle && (
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(240,237,234,0.55)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {map.subtitle}
              </div>
            )}
          </div>
          {map.bearing && (
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: GOLD,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {map.bearing}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PokoMapCard.displayName = "PokoMapCard";
export default PokoMapCard;
