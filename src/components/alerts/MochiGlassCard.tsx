import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { usePermitInsights, formatHour, formatPeakDays } from "@/hooks/usePermitInsights";
import { useScannerStatus } from "@/hooks/useScannerStatus";

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

interface MochiGlassCardProps {
  permitName?: string;
  parkName?: string;
  watchCount?: number;
  hasFound?: boolean;
  darkMode?: boolean;
  onArrowPress?: () => void;
}

/* ── Sentence starter rotation ─────────────────────────────── */
const STARTERS_P1 = [
  (name: string) => `I've been watching ${name} —`,
  (name: string) => `Scanning ${name} around the clock —`,
  (name: string) => `Standing by on ${name} —`,
  (name: string) => `Nothing yet for ${name} —`,
];
const STARTERS_P2 = [
  "Scanning every few minutes —",
  "Standing by —",
  "Nothing yet —",
  "I've been watching —",
];
const STARTERS_P3 = [
  "Scanning every 5 minutes.",
  "Just started watching.",
  "Standing by —",
];

/** Deterministic pick based on string hash so it's stable per-permit */
function pickStarter<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

/** Wrap numbers in bold spans for visual pop against italic prose */
function boldNumbers(text: string): ReactNode[] {
  const parts = text.split(/(\d+(?:\.\d+)?)/g);
  return parts.map((part, i) =>
    /^\d/.test(part) ? (
      <span key={i} style={{ fontWeight: 500, fontStyle: "normal", fontFamily: DM_SANS }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const MochiGlassCard = ({
  permitName,
  parkName,
  watchCount = 0,
  hasFound = false,
  darkMode = false,
  onArrowPress,
}: MochiGlassCardProps) => {
  const insightData = usePermitInsights(parkName, permitName);
  const { lastSuccessfulScanAt, getTimeAgo } = useScannerStatus();

  const isEmptyState = watchCount === 0;
  const isFoundState = hasFound;

  // Status semantics drive the emblem state (no mascot art on this surface)
  const statusKey = isEmptyState ? "STANDBY" : isFoundState ? "OPENING" : "WATCHING";
  const statusDot = isFoundState ? "#E8C674" : "#C9A96E";

  const contextualHeadline = isEmptyState
    ? "Ready to watch"
    : isFoundState
      ? "Opening detected"
      : "On watch";

  /* ── Build the briefing message ───────────────────────────── */
  const seed = `${parkName ?? ""}:${permitName ?? ""}`;
  let contextualMessage: string;

  if (isEmptyState) {
    contextualMessage = "Add your first alert and I'll start checking Recreation.gov every 2 minutes.";
  } else if (isFoundState) {
    contextualMessage = "Book it before it's gone.";
  } else {
    const scanAgo = lastSuccessfulScanAt ? getTimeAgo(lastSuccessfulScanAt) : null;
    const scanStr = scanAgo ? `Scanned ${scanAgo}` : null;

    if (insightData && insightData.total_detections > 0) {
      // Priority 1 — historical data exists
      const starter = pickStarter(STARTERS_P1, seed)(permitName ?? "this permit");
      const dayPattern = formatPeakDays(insightData.peak_days);
      const timeStr = insightData.best_hour_local != null
        ? ` around ${formatHour(insightData.best_hour_local)}`
        : "";

      if (insightData.total_detections < 3) {
        contextualMessage = `${starter} only ${insightData.total_detections} spot${insightData.total_detections === 1 ? "" : "s"} found recently. I'm staying extra vigilant.`;
      } else {
        const countPart = insightData.total_detections >= 5
          ? `${insightData.total_detections} openings this week`
          : `a few openings recently`;
        contextualMessage = `${starter} ${countPart} — peaks ${dayPattern}${timeStr}. ${scanStr ?? "Scanning now"}, nothing yet.`;
      }
    } else if (scanStr) {
      // Priority 2 — scan active, no catch history
      const starter = pickStarter(STARTERS_P2, seed);
      contextualMessage = `${starter} ${scanStr.toLowerCase()}, quiet so far. Cancellations for this permit tend to drop mid-week. I'll alert you the moment one appears.`;
    } else {
      // Priority 3 — cold start
      const starter = pickStarter(STARTERS_P3, seed);
      contextualMessage = `${starter} This permit typically sees openings mid-week — I'll alert you the second one drops.`;
    }
  }

  const isLoading = !isEmptyState && !isFoundState && !insightData;
  const disclaimerColor = darkMode ? "rgba(240,237,234,0.38)" : "rgba(26,24,20,0.4)";

  return (
    <div
      style={{
        position: "relative",
        margin: "0 20px",
        padding: 0,
        background:
          "linear-gradient(180deg, rgba(36,60,42,0.94) 0%, rgba(24,44,30,0.92) 55%, rgba(20,38,26,0.94) 100%)",
        border: "1px solid rgba(201,169,110,0.20)",
        borderRadius: 14,
        backdropFilter: "blur(16px) saturate(120%)",
        WebkitBackdropFilter: "blur(16px) saturate(120%)",
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.08)",
          "inset 0 -1px 0 rgba(0,0,0,0.28)",
          "0 28px 48px -24px rgba(0,0,0,0.55)",
          "0 12px 24px -14px rgba(0,0,0,0.42)",
          "0 1px 2px rgba(0,0,0,0.40)",
        ].join(", "),
        overflow: "hidden",
      }}
    >
      {/* Inner top-light highlight — simulated key light from above */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 70,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 50%, transparent 100%)",
          pointerEvents: "none",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />
      {/* Gold filament top edge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.55) 50%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Subtle right-side rim shadow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 8, right: 0, bottom: 8, width: 1,
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.20) 50%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ padding: "18px 20px 16px" }}>
        <div className="flex items-start gap-4">
          {/* Cartographer's emblem — engraved compass medallion with breathing pulse */}
          <motion.div
            aria-hidden
            className="shrink-0 self-start"
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 32% 28%, rgba(255,250,235,0.10) 0%, rgba(0,0,0,0.0) 55%), linear-gradient(160deg, rgba(36,60,42,0.95) 0%, rgba(20,38,26,0.98) 100%)",
              border: "1px solid rgba(201,169,110,0.45)",
              boxShadow: [
                "inset 0 1px 0 rgba(255,255,255,0.10)",
                "inset 0 -1px 2px rgba(0,0,0,0.45)",
                "0 2px 6px rgba(0,0,0,0.35)",
              ].join(", "),
            }}
            animate={isLoading ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={isLoading ? { duration: 3.6, repeat: Infinity, ease: [0.4, 0, 0.2, 1] } : { duration: 0.3 }}
          >
            <svg viewBox="0 0 44 44" width="44" height="44" style={{ display: "block" }}>
              {/* outer ring tick marks */}
              <g stroke="#C9A96E" strokeOpacity="0.55" strokeWidth="0.6">
                {Array.from({ length: 16 }).map((_, i) => {
                  const a = (i * Math.PI * 2) / 16;
                  const r1 = 17, r2 = i % 4 === 0 ? 14.5 : 15.8;
                  return (
                    <line
                      key={i}
                      x1={22 + Math.cos(a) * r1}
                      y1={22 + Math.sin(a) * r1}
                      x2={22 + Math.cos(a) * r2}
                      y2={22 + Math.sin(a) * r2}
                    />
                  );
                })}
              </g>
              {/* inner hairline ring */}
              <circle cx="22" cy="22" r="12.5" fill="none" stroke="#C9A96E" strokeOpacity="0.32" strokeWidth="0.5" />
              {/* compass needle */}
              <g transform="translate(22 22)">
                <polygon points="0,-11 2.2,0 0,2 -2.2,0" fill="#C9A96E" opacity="0.95" />
                <polygon points="0,11 2.2,0 0,-2 -2.2,0" fill="#C9A96E" opacity="0.35" />
                <circle cx="0" cy="0" r="1.4" fill="#1A2812" stroke="#C9A96E" strokeWidth="0.6" />
              </g>
            </svg>
            {/* live status dot */}
            <span
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusDot,
                boxShadow: `0 0 0 2px rgba(20,38,26,0.95), 0 0 8px ${statusDot}`,
                animation: isFoundState
                  ? "pokoCaret 1.1s ease-in-out infinite"
                  : "pokoDot 2.6s ease-in-out infinite",
              }}
            />
          </motion.div>
          <div className="flex-1 min-w-0">
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.28em",
                textTransform: "uppercase" as const,
                color: "rgba(201,169,110,0.78)",
                marginBottom: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {statusKey}
              <span style={{ width: 14, height: 1, background: "rgba(201,169,110,0.35)", display: "inline-block" }} />
              <span style={{ color: "rgba(244,241,236,0.55)", letterSpacing: "0.18em" }}>{contextualHeadline}</span>
            </span>
            <div className="flex items-end gap-2">
              <p
                style={{
                  fontFamily: CORMORANT,
                  fontSize: "17px",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#F4F1EC",
                  lineHeight: "1.55",
                  marginTop: 4,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {boldNumbers(contextualMessage)}
              </p>
              {!isEmptyState && (
                <button
                  onClick={onArrowPress}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    opacity: 0.45,
                    flexShrink: 0,
                    marginBottom: 2,
                  }}
                  aria-label="View permit details"
                >
                  <ChevronRight size={16} color="#F4F1EC" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hairline separator */}
        <div
          aria-hidden
          style={{
            height: 1,
            marginTop: 14,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.18) 50%, transparent 100%)",
          }}
        />
        <p
          style={{
            fontFamily: CORMORANT,
            fontSize: 12,
            fontStyle: "italic",
            color: disclaimerColor,
            marginTop: 10,
            lineHeight: 1.4,
            letterSpacing: "0.01em",
          }}
        >
          Verify all permit info with official park sources before booking.
        </p>
      </div>
    </div>
  );
};

export default MochiGlassCard;
