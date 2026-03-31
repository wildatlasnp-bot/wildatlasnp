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
}

const DEFAULT_CHIPS = ["Half Dome"];
const DEFAULT_MESSAGES: Record<string, string> = {
  "Half Dome": "Half Dome permits drop most often on Tuesday mornings — I'll watch for you.",
};

const MochiGlassCard = ({ chips, chipMessages, permitName, parkName }: MochiGlassCardProps) => {
  const displayChips = permitName ? [permitName] : (chips ?? DEFAULT_CHIPS);
  const messages = chipMessages ?? DEFAULT_MESSAGES;
  const [activeChip, setActiveChip] = useState<string>(displayChips[0]);
  const dataInsight = usePermitInsights(parkName, permitName);
  const message = dataInsight
    ?? (permitName
      ? `I've got my eyes on ${permitName} — watching Recreation.gov around the clock. The second a spot opens, you'll be the first to know.`
      : messages[activeChip]
        ?? `${activeChip} — I'm keeping an eye on this for you.`);

  const isLoading = !dataInsight;

  return (
    <div
      style={{
        margin: "0 20px 16px",
        padding: "14px 16px",
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(47,111,78,0.12)",
        borderRadius: 16,
      }}
    >
      <div className="flex items-start gap-3">
        <motion.img
          src="/mochi-standing.png"
          alt="Mochi"
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
              color: "#2F6F4E",
              display: "block",
            }}
          >
            MOCHI
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
            {message}
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
    </div>
  );
};

export default MochiGlassCard;
