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
      className="flex items-center justify-between"
      style={{
        margin: "0 20px 20px",
        padding: "12px 16px",
        borderRadius: 14,
        background: "rgba(184,148,58,0.06)",
        border: "1px solid rgba(184,148,58,0.18)",
        gap: 12,
        cursor: "pointer",
        width: "calc(100% - 40px)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: DM_SANS,
            fontSize: 13,
            fontWeight: 500,
            color: "#1C1812",
            lineHeight: 1.35,
          }}
        >
          Track {parkList} + 6 more parks
        </p>
        <p
          style={{
            fontFamily: DM_SANS,
            fontSize: 11,
            fontWeight: 300,
            color: "rgba(28,24,18,0.5)",
            marginTop: 2,
          }}
        >
          2-min scans · from {priceLabel}
        </p>
      </div>
      <span
        style={{
          fontFamily: DM_SANS,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "white",
          background: "#2F6F4E",
          padding: "7px 13px",
          borderRadius: 8,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        UPGRADE
      </span>
    </button>
  );
};

export default UpgradeNudgeCard;
