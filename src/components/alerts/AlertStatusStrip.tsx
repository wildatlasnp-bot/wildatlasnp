import { ChevronDown } from "lucide-react";

const AlertStatusStrip = () => {
  const handleTap = () => {
    const el = document.querySelector("[data-park-alerts]");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      onClick={handleTap}
      className="flex items-center w-auto text-left cursor-pointer"
      style={{
        margin: "0 24px",
        borderRadius: 10,
        border: "1px solid var(--amber-bd)",
        background: "var(--amber-bg)",
        padding: "9px 13px",
        gap: 9,
      }}
    >
      {/* Pulsing amber dot */}
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: "var(--ds-amber)",
          animation: "amber-pulse 2.2s ease-in-out infinite",
        }}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--ds-amber)",
            lineHeight: 1.3,
          }}
        >
          1 alert in your parks today
        </p>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10.5,
            fontWeight: 300,
            color: "var(--ds-amber)",
            opacity: 0.65,
            lineHeight: 1.3,
            marginTop: 1,
          }}
        >
          Tioga Road closed · Yosemite
        </p>
      </div>

      {/* Chevron */}
      <ChevronDown size={13} style={{ color: "rgba(138,74,16,0.45)" }} className="shrink-0" />
    </button>
  );
};

export default AlertStatusStrip;
