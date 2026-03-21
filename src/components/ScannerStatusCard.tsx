import { useState, useEffect, useRef } from "react";
import { Plus, Check, RotateCw } from "lucide-react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { type ScannerState } from "@/lib/scanner-status";
const mochiScanning = "/mochi-binoculars.png";
const mochiChilling = "/mochi-neutral.png";
const mochiWorried = "/mochi-worried.png";

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

  const isEmpty = activeCount === 0;
  const prevEmptyRef = useRef(isEmpty);
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (prevEmptyRef.current && !isEmpty) {
      setShowCheckmark(true);
      const timer = setTimeout(() => setShowCheckmark(false), 1800);
      return () => clearTimeout(timer);
    }
    prevEmptyRef.current = isEmpty;
  }, [isEmpty]);

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
      className="rounded-[20px] border border-border/60 p-4"
      style={{ boxShadow: "var(--card-shadow)", backgroundColor: "hsl(var(--surface-warm))" }}
      aria-label="Permit Scanner status"
    >
      {/* Header row — title left, Mochi right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-[20px] font-bold text-foreground leading-tight">
            Permit Scanner
          </p>
          {!isEmpty && scannerState === "active" && (
            <p className="mt-0.5 text-[12px] font-normal text-text-subtle">Scanning Recreation.gov</p>
          )}
        </div>
        {!isEmpty && scannerState === "active" && (
          <img
            src={mochiScanning}
            alt="Mochi scanning"
            className="shrink-0 object-contain"
            style={{ width: 56, aspectRatio: "1/1" }}
          />
        )}
      </div>

      {/* Mochi worried illustration — shown when scanner is in error state */}
      {!isEmpty && scannerState === "error" && (
        <div className="flex justify-center mb-2">
          <img
            src={mochiWorried}
            alt="Mochi worried"
            className="w-20 h-20 object-contain"
          />
        </div>
      )}

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
            <div className="flex flex-col items-center mb-3" style={{ gap: "12px" }}>
              <div style={{ width: "min(140px, 30vw)" }}>
                <img
                  src={mochiChilling}
                  alt="Mochi relaxing"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
            <p className="text-[14px] text-muted-foreground font-normal mb-4 leading-snug text-center">
              No permits tracked yet
            </p>
            <div className="flex justify-center">
              <motion.button
                onClick={onAddPermit}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold px-4 py-2.5 hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} aria-hidden="true" />
                Track a Permit
              </motion.button>
            </div>
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
                <div className="flex items-center" style={{ gap: 6 }}>
                  {/* Decorative dot — aria-hidden; text label carries the meaning */}
                  <motion.span
                    className="relative flex shrink-0"
                    style={{ width: 8, height: 8 }}
                    animate={dotControls}
                    aria-hidden="true"
                  >
                    {dot.ping && (
                      <span
                        className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                        style={{ animationDuration: "2s" }}
                      />
                    )}
                    {dot.pulse && (
                      <span
                        className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                      />
                    )}
                    <span className={`relative inline-flex rounded-full h-full w-full ${dot.dotClass}`} />
                  </motion.span>
                  <span className="text-[13px] font-normal leading-snug text-scanner-text">
                    {label}
                  </span>
                </div>

                {/* Checkmark confirmation — appears briefly on first permit add */}
                <AnimatePresence>
                  {showCheckmark && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 2 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="flex items-center gap-2 pl-[18px]"
                    >
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-status-quiet/20">
                        <Check size={10} className="text-status-quiet" strokeWidth={3} />
                      </span>
                      <span className="text-[12px] font-medium text-status-quiet">
                        Monitoring started
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pills row */}
                {!isEmpty && (
                  <div className="flex items-center" style={{ gap: 6 }}>
                     <span className="text-[11px] font-semibold rounded-full bg-park-pill-bg text-park-pill-text" style={{ padding: "2px 10px" }}>
                      {activeCount} Permit{activeCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-semibold rounded-full bg-park-pill-bg text-park-pill-text" style={{ padding: "2px 10px" }}>
                      {trackedParkCount} Park{trackedParkCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                {metaLine && (
                  <div className="flex items-center pl-[14px]">
                    <RotateCw size={12} className="text-text-subtle shrink-0 mr-1" />
                    <span className="text-[11px] text-text-subtle">{metaLine}</span>
                  </div>
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
