import { useState, useEffect, useRef } from "react";
import { Plus, Check } from "lucide-react";
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
  estimatedScans: number;
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

const MOCHI_IMAGE: Record<ScannerState, string> = {
  active:   mochiScanning,
  starting: mochiScanning,
  delayed:  mochiWorried,
  paused:   mochiChilling,
  error:    mochiWorried,
};

const ScannerStatusCard = ({
  scannerState,
  activeCount,
  trackedParkCount,
  lastSuccessfulScanAt,
  getTimeAgo,
  onAddPermit,
  estimatedScans,
}: ScannerStatusCardProps) => {
  const scanCount = estimatedScans;
  // Tick every 15s so timestamps stay fresh
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
  const mochiImage = MOCHI_IMAGE[scannerState];
  const lastCheckText = lastSuccessfulScanAt ? getTimeAgo(lastSuccessfulScanAt) : "—";

  // Force re-read of lastCheckText on tick
  void tick;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-[20px] p-4"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(47, 111, 78, 0.15)",
        boxShadow: "var(--card-shadow)",
      }}
      aria-label="Permit Scanner status"
    >
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
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto object-contain"
                  loading="lazy"
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
                aria-label="Add permit alert"
                style={{ minHeight: 44 }}
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
            {/* Top row: Mochi + status text */}
            <div className="flex items-center gap-3">
              <img
                src={mochiImage}
                alt="Mochi"
                className="shrink-0 object-contain"
                style={{ width: 48, height: 48 }}
                loading="lazy"
              />
              <div className="flex flex-col min-w-0">
                {/* Title with dot */}
                <div className="flex items-center" style={{ gap: 6 }}>
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>
                    {label}
                  </span>
                </div>
                {/* Subtitle */}
                <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF", lineHeight: 1.4, marginTop: 1 }}>
                  Recreation.gov · last check {lastCheckText}
                </span>
              </div>
            </div>

            {/* Checkmark confirmation */}
            <AnimatePresence>
              {showCheckmark && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="flex items-center gap-2 mt-2 ml-[60px]"
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

            {/* 3 stat boxes */}
            <div className="flex mt-3" style={{ gap: 8 }}>
              {/* Scans */}
              <div
                className="flex-1 flex flex-col items-center justify-center"
                style={{ background: "#F7F6F3", borderRadius: 8, padding: "7px 8px" }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: scanCount === 0 ? "#999" : "#1a1a1a", lineHeight: 1.2 }}>
                  {scanCount === 0 ? "—" : scanCount}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#2F6F4E", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Scans run
                </span>
              </div>
              {/* Permits */}
              <div
                className="flex-1 flex flex-col items-center justify-center"
                style={{ background: "#F7F6F3", borderRadius: 8, padding: "7px 8px" }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                  {activeCount}
                </span>
                <span style={{ fontSize: 9, fontWeight: 500, color: "#9CA3AF", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {activeCount === 1 ? "Permit" : "Permits"}
                </span>
              </div>
              {/* Last check */}
              <div
                className="flex-1 flex flex-col items-center justify-center"
                style={{ background: "#F7F6F3", borderRadius: 8, padding: "7px 8px" }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                  {lastCheckText}
                </span>
                <span style={{ fontSize: 9, fontWeight: 500, color: "#9CA3AF", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Last check
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ScannerStatusCard;
