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
}

const DEFAULT_CHIPS = ["Half Dome"];
const DEFAULT_MESSAGES: Record<string, string> = {
  "Half Dome": "Half Dome permits drop most often on Tuesday mornings — I'll watch for you.",
};

const MochiGlassCard = ({ chips, chipMessages, permitName, parkName, watchCount = 0, hasFound = false }: MochiGlassCardProps) => {
  const displayChips = permitName ? [permitName] : (chips ?? DEFAULT_CHIPS);
  const messages = chipMessages ?? DEFAULT_MESSAGES;
  const [activeChip, setActiveChip] = useState<string>(displayChips[0]);
  const dataInsight = usePermitInsights(parkName, permitName);

  // Determine Mochi state
  const isEmptyState = watchCount === 0;
  const isFoundState = hasFound;
  // scanning = has watchers, nothing found

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

  const headlineColor = isFoundState ? "#2F6F4E" : "#2F6F4E";

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

  return (
    <div
      style={{
        margin: "0 20px",
        padding: "0 0px",
      }}
    >
      {/* PARK GUIDE header — gold/amber */}
      <span
        className="font-body"
        style={{
          display: "block",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: "#BA7517",
          marginBottom: 10,
        }}
      >
        Park Guide
      </span>

      <div className="flex items-start gap-3">
        <motion.img
          src={mochiImage}
          alt="Poko"
          className="shrink-0 object-contain"
          style={{ height: 68, width: "auto" }}
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
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: headlineColor,
              display: "block",
            }}
          >
            {contextualHeadline}
          </span>
          <p
            style={{
              fontFamily: CORMORANT,
              fontSize: 16,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#1C1812",
              lineHeight: 1.4,
              marginTop: 3,
              borderLeft: isLoading ? "none" : "2.5px solid rgba(47,111,78,0.4)",
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
                  color: "#1A5238",
                  background: "rgba(47,111,78,0.08)",
                  border: "1px solid rgba(47,111,78,0.28)",
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

      {/* Disclaimer — always visible */}
      <p
        className="font-body"
        style={{
          fontSize: 10,
          color: "rgba(26,24,20,0.4)",
          marginTop: 10,
          lineHeight: 1.4,
        }}
      >
        Verify all permit info with official park sources before booking.
      </p>
    </div>
  );
};

export default MochiGlassCard;
