import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { type ScannerState } from "@/lib/scanner-status";

interface ScannerStatusCardProps {
  scannerState: ScannerState;
  activeCount: number;
  trackedParkCount: number;
  lastSuccessfulScanAt: string | null;
  getTimeAgo: (dateStr: string) => string;
  onAddPermit: () => void;
}

type DotConfig = {
  dotClass: string;
  ping: boolean;
  pulse: boolean;
};

const DOT_CONFIG: Record<ScannerState, DotConfig> = {
  active:  { dotClass: "bg-status-quiet",          ping: true,  pulse: false },
  starting:{ dotClass: "bg-yellow-400",             ping: false, pulse: true  },
  delayed: { dotClass: "bg-status-busy",            ping: false, pulse: true  },
  paused:  { dotClass: "bg-muted-foreground/50",    ping: false, pulse: false },
  error:   { dotClass: "bg-status-peak",            ping: false, pulse: true  },
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

/** Metadata line copy per state */
function getMetaLine(
  state: ScannerState,
  lastScanAt: string | null,
  getTimeAgo: (d: string) => string,
  tick: number, // used to force re-render
): string | null {
  void tick;
  switch (state) {
    case "active":
      return lastScanAt ? `Last checked ${getTimeAgo(lastScanAt)}` : null;
    case "starting":
      return "Setting up your permit monitor";
    case "delayed":
    case "paused":
      return "Resume scanning in Settings";
    case "error":
      return "Retrying in 2 minutes…";
    default:
      return null;
  }
}

const ScannerStatusCard = ({
  scannerState,
  activeCount,
  trackedParkCount,
  lastSuccessfulScanAt,
  getTimeAgo,
  onAddPermit,
}: ScannerStatusCardProps) => {
  // Tick every 15s so "Last checked X ago" stays fresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (scannerState !== "active") return;
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [scannerState]);

  const isEmpty = activeCount === 0;
  const dot = DOT_CONFIG[scannerState];
  const label = STATUS_LABEL[scannerState];
  const labelColor = STATUS_LABEL_COLOR[scannerState];
  const metaLine = getMetaLine(scannerState, lastSuccessfulScanAt, getTimeAgo, tick);

  const summaryText = (() => {
    if (isEmpty) return null;
    const permitPart = `${activeCount} active permit${activeCount !== 1 ? "s" : ""}`;
    const parkPart   = `${trackedParkCount} park${trackedParkCount !== 1 ? "s" : ""} monitored`;
    return `${permitPart} • ${parkPart}`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-[20px] border border-border/60 bg-card p-5"
      style={{ boxShadow: "var(--card-shadow)" }}
      aria-label="Permit Scanner status"
    >
      {/* Line 1 — Title */}
      <p className="text-[20px] font-bold text-foreground leading-tight mb-2">
        Permit Scanner
      </p>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-[14px] text-muted-foreground font-normal mb-4 leading-snug">
              No permits tracked yet
            </p>
            <button
              onClick={onAddPermit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold px-4 py-2.5 hover:bg-primary/90 active:scale-[0.97] transition-all"
            >
              <Plus size={14} aria-hidden="true" />
              Track a Permit
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Lines 2–4 cross-fade on every state change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={scannerState}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-2"
              >
                {/* Line 2 — Dot + status label */}
                <div className="flex items-center gap-2">
                  {/* Decorative dot — aria-hidden; text label carries the meaning */}
                  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
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
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot.dotClass}`} />
                  </span>
                  <span className={`text-[15px] font-semibold leading-snug ${labelColor}`}>
                    {label}
                  </span>
                </div>

                {/* Line 3 — Summary count (lighter weight) */}
                {summaryText && (
                  <p className="text-[13px] font-normal text-muted-foreground leading-snug pl-[18px]">
                    {summaryText}
                  </p>
                )}

                {/* Line 4 — Metadata */}
                {metaLine && (
                  <p className="text-[12px] font-normal text-muted-foreground/70 leading-snug pl-[18px]">
                    {metaLine}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ScannerStatusCard;
