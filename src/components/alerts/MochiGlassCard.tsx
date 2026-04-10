import { useState } from "react";
import { motion } from "framer-motion";
import { usePermitInsights } from "@/hooks/usePermitInsights";

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

interface MochiGlassCardProps {
  chips?: string[];
  chipMessages?: Record<string, string>;
  permitName?: string;
  parkName?: string;
  watchCount?: number;
  hasFound?: boolean;
  darkMode?: boolean;
}

const DEFAULT_CHIPS = ["Half Dome"];
const DEFAULT_MESSAGES: Record<string, string> = {
  "Half Dome": "Half Dome permits drop most often on Tuesday mornings — I'll watch for you.",
};

const MochiGlassCard = ({ chips, chipMessages, permitName, parkName, watchCount = 0, hasFound = false, darkMode = false }: MochiGlassCardProps) => {
  const displayChips = permitName ? [permitName] : (chips ?? DEFAULT_CHIPS);
  const messages = chipMessages ?? DEFAULT_MESSAGES;
  const [activeChip, setActiveChip] = useState<string>(displayChips[0]);
  const dataInsight = usePermitInsights(parkName, permitName);

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
      : "POKO";

  const contextualMessage = isEmptyState
    ? "Add your first alert and I'll start checking Recreation.gov every 2 minutes."
    : isFoundState
      ? "Book it before it's gone."
      : (dataInsight
          ?? (permitName
            ? `I've got my eyes on ${permitName} — watching Recreation.gov around the clock. The second a spot opens, you'll be the first to know.`
            : messages[activeChip]
              ?? `${activeChip} — I'm keeping an eye on this for you.`));

  const isLoading = !isEmptyState && !isFoundState && !dataInsight;

  // Dark mode colors
  const labelColor = darkMode ? "#A8C4B8" : "#BA7517";
  const headlineColor = darkMode ? "#A8C4B8" : "#2F6F4E";
  const quoteColor = darkMode ? "#F5F0E8" : "#1C1812";
  const quoteBorderColor = darkMode ? "rgba(168,196,184,0.4)" : "rgba(47,111,78,0.4)";
  const chipTextColor = darkMode ? "#F5F0E8" : "#1A5238";
  const chipBg = darkMode ? "rgba(255,255,255,0.12)" : "rgba(47,111,78,0.08)";
  const chipBorder = darkMode ? "rgba(255,255,255,0.2)" : "rgba(47,111,78,0.28)";
  const disclaimerColor = darkMode ? "rgba(240,237,234,0.38)" : "rgba(26,24,20,0.4)";
  const leftBorderColor = darkMode ? "rgba(201,169,110,0.80)" : "#2F6F4E";

  return (
    <div
      style={{
        margin: "0 16px",
        padding: 16,
        background: "rgba(26,47,30,0.88)",
        border: "none",
        borderLeft: "2.5px solid #C9A96E",
        borderRadius: "0 12px 12px 0",
        backdropFilter: darkMode ? "blur(12px)" : undefined,
        WebkitBackdropFilter: darkMode ? "blur(12px)" : undefined,
      }}
    >
      <div
        style={{
          paddingLeft: 0,
        }}
      >
      <span
        style={{
          display: "block",
          fontFamily: DM_SANS,
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase" as const,
          letterSpacing: "0.12em",
          color: "rgba(240,237,234,0.45)",
          marginBottom: 10,
        }}
      >
        Park guide
      </span>

      <div className="flex items-start gap-3">
        <motion.img
          src={mochiImage}
          alt="Poko"
           className="shrink-0 object-contain self-start"
           style={{ width: 52, height: 52 }}
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
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#D4B782",
              marginTop: 4,
              marginBottom: 2,
              display: "block",
            }}
          >
            {contextualHeadline === "POKO" ? "Poko" : contextualHeadline}
          </span>
          <p
            style={{
              fontFamily: CORMORANT,
              fontSize: 17,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#F0EDEA",
              lineHeight: 1.6,
              marginTop: 3,
              maxWidth: "88%",
              paddingRight: 8,
              borderLeft: isLoading ? "none" : `2.5px solid ${quoteBorderColor}`,
              paddingLeft: isLoading ? 0 : 8,
            }}
          >
            {contextualMessage}
          </p>
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {displayChips.map((chip) => (
              <motion.button
                key={chip}
                onClick={() => setActiveChip(chip)}
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 11,
                  fontWeight: 500,
                  color: chipTextColor,
                  background: chipBg,
                  border: `1px solid ${chipBorder}`,
                  borderRadius: 99,
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <p
        style={{
          fontFamily: CORMORANT,
          fontSize: 11,
          fontStyle: "italic",
          color: disclaimerColor,
          marginTop: 10,
          lineHeight: 1.4,
        }}
      >
        Verify all permit info with official park sources before booking.
      </p>
      </div>
    </div>
  );
};

export default MochiGlassCard;
