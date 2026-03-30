import { type ScannerState } from "@/lib/scanner-status";

interface ScannerLineProps {
  scannerState: ScannerState;
  lastScanAt: string | null;
  getTimeAgo: (dateStr: string) => string;
  isPro?: boolean;
}

const INTER = "'Inter', sans-serif";

const ScannerLine = ({ scannerState, lastScanAt, getTimeAgo, isPro = true }: ScannerLineProps) => {
  const isActive = scannerState === "active";

  return (
    <div
      className="flex items-center justify-between"
      style={{
        margin: "10px 24px 0",
        padding: "7px 0",
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-2">
        <span className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
          {isActive && (
            <span
              className="absolute rounded-full"
              style={{
                width: 10,
                height: 10,
                backgroundColor: "rgba(46,93,70,0.25)",
                animation: "scanner-pulse-ring 2s ease-out infinite",
              }}
            />
          )}
          <span
            className="relative rounded-full"
            style={{
              width: 5,
              height: 5,
              backgroundColor: isActive ? "#2E5D46" : "var(--dim)",
            }}
          />
        </span>
        <span style={{ fontFamily: INTER, fontSize: 10.5, color: "var(--ds-muted)" }}>
          {isActive ? "Scanner active" : "Scanner paused"} · Recreation.gov
        </span>
      </div>

      {/* Right */}
      <span style={{ fontFamily: INTER, fontSize: 10.5, color: "var(--dim)" }}>
        {isPro ? (
          <>
            <span style={{ color: "var(--ds-gold)" }}>Pro</span> · 2-min
          </>
        ) : (
          <>Free · 5-min</>
        )}
      </span>
    </div>
  );
};

export default ScannerLine;
