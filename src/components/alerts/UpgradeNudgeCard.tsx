const INTER = "'Inter', sans-serif";

interface UpgradeNudgeCardProps {
  parkNames?: string[];
  priceLabel?: string;
}

const UpgradeNudgeCard = ({ parkNames = ["Zion", "Rainier", "Grand Teton"], priceLabel = "$9.99/mo" }: UpgradeNudgeCardProps) => {
  const parkList = parkNames.slice(0, 3).join(", ");

  return (
    <div
      className="flex items-center justify-between"
      style={{
        margin: "0 24px 6px",
        padding: "12px 16px",
        borderRadius: 14,
        background: "rgba(184,148,58,0.07)",
        border: "1px solid rgba(184,148,58,0.2)",
        gap: 12,
      }}
    >
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: INTER, fontSize: 13, fontWeight: 500, color: "var(--ink2)", lineHeight: 1.35 }}>
          Track {parkList} + more
        </p>
        <p style={{ fontFamily: INTER, fontSize: 11, fontWeight: 300, color: "var(--ds-muted)", marginTop: 2 }}>
          2-min scans · from {priceLabel}
        </p>
      </div>
      <span
        style={{
          fontFamily: INTER,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "white",
          background: "var(--ds-gold)",
          padding: "5px 11px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        UPGRADE TO PRO
      </span>
    </div>
  );
};

export default UpgradeNudgeCard;
