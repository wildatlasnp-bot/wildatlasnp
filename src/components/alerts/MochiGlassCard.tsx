import { useState } from "react";

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
  const permitMessage = permitName
    ? `I've got my eyes on ${permitName}. These can be tricky to snag — I'll alert you the second a spot opens up.`
    : undefined;
  const message = permitMessage ?? messages[activeChip] ?? `${activeChip} — I'm keeping an eye on this for you.`;

  return (
    <div style={{ padding: "0 20px", marginBottom: 16 }}>
      <div className="flex items-start gap-3">
        <img
          src="/mochi-standing.png"
          alt="Mochi"
          className="shrink-0 object-contain"
          style={{ height: 52, width: "auto" }}
        />
        <div className="flex-1 min-w-0">
          <span
            style={{
              fontFamily: DM_SANS,
              fontSize: 8,
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
            }}
          >
            {message}
          </p>
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {displayChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveChip(chip)}
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#2F6F4E",
                  background: "rgba(47,111,78,0.08)",
                  border: "1px solid rgba(47,111,78,0.2)",
                  borderRadius: 99,
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MochiGlassCard;
