import { useState } from "react";

const CHIPS = ["Half Dome", "Camp Muir", "Highline"] as const;

const CHIP_MESSAGES: Record<string, string> = {
  "Half Dome": "Half Dome permits drop most often on Tuesday mornings — I'll watch for you.",
  "Camp Muir": "Camp Muir has had 3 openings this week. Stay ready to book fast.",
  "Highline": "Highline permits are popular — cancellations usually appear mid-week.",
};

const MochiGlassCard = () => {
  const [activeChip, setActiveChip] = useState<string>(CHIPS[0]);
  const message = CHIP_MESSAGES[activeChip] ?? CHIP_MESSAGES[CHIPS[0]];

  return (
    <div
      style={{
        margin: "10px 20px 0",
        borderRadius: 14,
        background: "rgba(26,47,35,0.07)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "0.5px solid rgba(255,255,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
        padding: "12px 14px",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Mochi avatar */}
        <div
          className="shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(28,56,40,0.1)",
          }}
        >
          <img
            src="/mochi-neutral.png"
            alt="Mochi"
            className="w-full h-full object-contain object-center"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color: "var(--forest-m)",
            }}
          >
            MOCHI
          </span>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 300,
              color: "var(--ink2)",
              lineHeight: 1.5,
              marginTop: 3,
            }}
          >
            {message}
          </p>

          {/* Chip row */}
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveChip(chip)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--forest-m)",
                  background:
                    activeChip === chip
                      ? "rgba(28,56,40,0.15)"
                      : "rgba(28,56,40,0.08)",
                  border: "1px solid rgba(28,56,40,0.13)",
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
