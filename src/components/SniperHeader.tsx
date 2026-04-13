import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  activeCount: number;
  scannerState: ScannerState;
  lastChecked: string | null;
  trackedParkCount: number;
  getTimeAgo: (dateStr: string) => string;
}

type DotStyle = 'heartbeat-ripple' | 'heartbeat' | 'static';

const DOT_CONFIG: Record<ScannerState, { style: DotStyle }> = {
  active:   { style: "heartbeat-ripple" },
  starting: { style: "heartbeat" },
  delayed:  { style: "static" },
  paused:   { style: "static" },
  error:    { style: "static" },
};

const DOT_CLASS: Record<ScannerState, string> = {
  active:   "bg-status-quiet",
  starting: "bg-yellow-400",
  delayed:  "bg-status-busy",
  paused:   "bg-muted-foreground/50",
  error:    "bg-[#E24B4A]",
};

const STATUS_LABEL: Record<ScannerState, string> = {
  active:   "Watching for openings",
  starting: "Starting up…",
  delayed:  "Temporarily paused",
  paused:   "Temporarily paused",
  error:    "Scanner unavailable",
};

const STATUS_LABEL_COLOR: Record<ScannerState, string> = {
  active:   "text-status-quiet",
  starting: "text-yellow-500",
  delayed:  "text-status-busy",
  paused:   "text-muted-foreground",
  error:    "text-status-peak",
};

const SniperHeader = ({
  activeCount,
  scannerState,
  lastChecked,
  trackedParkCount,
  getTimeAgo,
}: SniperHeaderProps) => {
  const dot = DOT_CONFIG[scannerState];

  // Bounce dot on starting → active promotion
  const dotControls = useAnimationControls();
  const prevStateRef = useRef<ScannerState>(scannerState);
  useEffect(() => {
    if (prevStateRef.current === "starting" && scannerState === "active") {
      dotControls.start({
        scale: [1, 1.7, 0.85, 1.15, 1],
        transition: { duration: 0.45, ease: "easeOut", times: [0, 0.3, 0.55, 0.75, 1] },
      });
    }
    prevStateRef.current = scannerState;
  }, [scannerState, dotControls]);
  const label = STATUS_LABEL[scannerState];
  const labelColor = STATUS_LABEL_COLOR[scannerState];

  const summaryText = activeCount > 0
    ? `${activeCount} permit${activeCount !== 1 ? "s" : ""} • ${trackedParkCount} park${trackedParkCount !== 1 ? "s" : ""}`
    : null;

  return (
    <div className="px-5 pt-4 pb-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={scannerState}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Row 1 — dot + label */}
          <div className="flex items-center gap-2">
            <motion.span className="relative flex h-2 w-2 shrink-0" animate={dotControls} aria-hidden="true">
              {dot.style === "heartbeat-ripple" && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full dot-ripple ${DOT_CLASS[scannerState]}`}
                />
              )}
              {(dot.style === "heartbeat-ripple" || dot.style === "heartbeat") && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full dot-heartbeat ${DOT_CLASS[scannerState]}`}
                />
              )}
              {dot.style === "static" && (
                <span className={`relative inline-flex rounded-full h-2 w-2 ${DOT_CLASS[scannerState]}`} />
              )}
            </motion.span>
            <span className={`text-[12px] font-semibold leading-snug ${labelColor}`}>
              {label}
            </span>
            {summaryText && (
              <span className="text-[12px] font-normal text-muted-foreground">
                · {summaryText}
              </span>
            )}
          </div>

          {/* Row 2 — metadata */}
          {scannerState === "active" && lastChecked && (
            <p className="text-[11px] font-normal text-muted-foreground/70 mt-1 pl-4">
              Checked {getTimeAgo(lastChecked)}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SniperHeader;
