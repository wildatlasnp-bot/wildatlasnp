import { motion, AnimatePresence } from "framer-motion";
import { type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  activeCount: number;
  scannerState: ScannerState;
  lastChecked: string | null;
  trackedParkCount: number;
  getTimeAgo: (dateStr: string) => string;
}

type DotConfig = { dotClass: string; ping: boolean; pulse: boolean };

const DOT_CONFIG: Record<ScannerState, DotConfig> = {
  active:   { dotClass: "bg-status-quiet",       ping: true,  pulse: false },
  starting: { dotClass: "bg-yellow-400",          ping: false, pulse: true  },
  delayed:  { dotClass: "bg-status-busy",         ping: false, pulse: true  },
  paused:   { dotClass: "bg-muted-foreground/50", ping: false, pulse: false },
  error:    { dotClass: "bg-status-peak",         ping: false, pulse: true  },
};

const STATUS_LABEL: Record<ScannerState, string> = {
  active:   "Scanner running",
  starting: "Starting scanner…",
  delayed:  "Scanner paused",
  paused:   "Scanner paused",
  error:    "Scanner error",
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
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              {dot.ping && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                  style={{ animationDuration: "1.6s" }}
                />
              )}
              {dot.pulse && (
                <span
                  className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${dot.dotClass}`} />
            </span>
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
              Last checked {getTimeAgo(lastChecked)}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SniperHeader;
