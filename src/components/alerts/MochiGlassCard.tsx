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

  const mochiImage = isEmptyState
    ? "/mochi-wave.png"
    : isFoundState
      ? "/mochi-celebrate.png"
      : "/mochi-binoculars.png";

  const contextualHeadline = isEmptyState
    ? "I'm ready to watch."
    : isFoundState
      ? "Got one!"
      : "Poko";

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
          "linear-gradient(180deg, rgba(34,58,40,0.92) 0%, rgba(22,42,28,0.92) 100%)",
        border: "1px solid rgba(201,169,110,0.18)",
        borderRadius: 14,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 18px 40px -22px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    >
      {/* Soft luminous top edge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.45) 50%, transparent 100%)",
        }}
      />
      <div style={{ padding: "16px 18px 14px" }}>
        <div className="flex items-start gap-3">
          <motion.img
            src={mochiImage}
            alt="Poko"
            className="shrink-0 object-contain self-start"
            style={{ width: "auto", height: 60, marginTop: -30, filter: "drop-shadow(0px 6px 14px rgba(0,0,0,0.35))" }}
            animate={isLoading ? { y: [0, -3, 0] } : { y: 0 }}
            transition={
              isLoading
                ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          />
          <div className="flex-1 min-w-0">
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase" as const,
                color: "#C9A96E",
                marginTop: 4,
                marginBottom: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C9A96E", display: "inline-block" }} />
              {contextualHeadline}
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
