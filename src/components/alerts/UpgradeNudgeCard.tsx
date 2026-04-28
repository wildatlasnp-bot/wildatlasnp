const DM_SANS = "'DM Sans', sans-serif";

interface UpgradeNudgeCardProps {
  parkNames?: string[];
  priceLabel?: string;
  onUpgrade?: () => void;
}

const UpgradeNudgeCard = ({
  parkNames = ["Zion", "Rainier"],
  priceLabel = "$9.99/mo",
  onUpgrade = () => {},
}: UpgradeNudgeCardProps) => {
  const parkList = parkNames.slice(0, 2).join(", ");

  return (
    <button
      onClick={onUpgrade}
      className="text-left"
      style={{
        display: "block",
        margin: "0 20px 20px",
        padding: "14px 16px",
        borderRadius: 14,
        background: "#EDE8E1",
        border: "1.5px solid rgba(47,111,78,0.85)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        cursor: "pointer",
        width: "calc(100% - 40px)",
      }}
    >
      {/* RECOMMENDED badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          style={{
            fontFamily: DM_SANS,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#FFFFFF",
            background: "#2F6F4E",
            borderRadius: 99,
            padding: "3px 10px",
          }}
        >
          Recommended
        </span>
      </div>

      {/* Headline */}
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18,
          fontWeight: 500,
          fontStyle: "italic",
          color: "#1A2E1F",
          lineHeight: 1.25,
          marginBottom: 4,
        }}
      >
        Track {parkList} + 6 more parks
      </p>

      {/* Descriptor */}
      <p
        style={{
          fontFamily: DM_SANS,
          fontSize: 12,
          fontWeight: 400,
          color: "rgba(28,24,18,0.5)",
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        2-min scans · Unlimited permits · SMS alerts
      </p>

      {/* CTA */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 42,
          borderRadius: 10,
          backgroundColor: "#2F6F4E",
          color: "#F0EDEA",
          fontFamily: DM_SANS,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Upgrade — {priceLabel}
      </span>
    </button>
  );
};

export default UpgradeNudgeCard;
