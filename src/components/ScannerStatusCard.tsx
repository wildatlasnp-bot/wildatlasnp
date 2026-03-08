import { useState, useEffect } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { SCANNER_STATE_LABELS, type ScannerState } from "@/lib/scanner-status";

interface ScannerStatusCardProps {
  scannerState: ScannerState;
  lastFound: string | null;
  activeCount: number;
  getTimeAgo: (dateStr: string) => string;
}

/**
 * System Status card — shows scanner state label only, never a timestamp.
 * The canonical timestamp lives in ParkStatusHeader.
 */
const ScannerStatusCard = ({
  scannerState,
  lastFound,
  activeCount,
  getTimeAgo,
}: ScannerStatusCardProps) => {
  const config: Record<ScannerState, {
    label: string;
    accentText: string;
    bgBorder: string;
    dotColor: string;
    ping: boolean;
    pulse: boolean;
  }> = {
    starting: {
      label: SCANNER_STATE_LABELS.starting,
      accentText: "text-muted-foreground",
      bgBorder: "bg-muted/30 border-border/40",
      dotColor: "bg-muted-foreground/40",
      ping: false,
      pulse: true,
    },
    active: {
      label: SCANNER_STATE_LABELS.active,
      accentText: "text-status-quiet",
      bgBorder: "bg-status-quiet/8 border-status-quiet/20",
      dotColor: "bg-status-quiet",
      ping: true,
      pulse: false,
    },
    delayed: {
      label: SCANNER_STATE_LABELS.delayed,
      accentText: "text-status-busy",
      bgBorder: "bg-status-busy/8 border-status-busy/20",
      dotColor: "bg-status-busy",
      ping: false,
      pulse: true,
    },
    paused: {
      label: SCANNER_STATE_LABELS.paused,
      accentText: "text-muted-foreground",
      bgBorder: "bg-muted/30 border-border/40",
      dotColor: "bg-muted-foreground/40",
      ping: false,
      pulse: false,
    },
    error: {
      label: SCANNER_STATE_LABELS.error,
      accentText: "text-status-peak",
      bgBorder: "bg-status-peak/8 border-status-peak/20",
      dotColor: "bg-status-peak",
      ping: false,
      pulse: true,
    },
  };

  // Tick every 30 seconds so "Found X ago" stays current without a parent re-render
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastFound) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastFound]);

  const c = config[scannerState];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-[18px] border p-5 ${c.bgBorder}`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {/* Header */}
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-foreground/40 mb-3">
        System Status
      </p>

      {/* Scanner state — label only, no timestamp */}
      <div className="flex items-center gap-3.5 mb-5">
        <span className="relative flex h-5 w-5 shrink-0">
          {c.ping && (
            <>
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dotColor} opacity-40`}
                style={{ animationDuration: "1.6s" }}
              />
              <span
                className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${c.dotColor} opacity-20`}
                style={{ animationDuration: "2.4s" }}
              />
            </>
          )}
          {c.pulse && !c.ping && (
            <span
              className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${c.dotColor} opacity-40`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-5 w-5 ${c.dotColor} ring-2 ring-background`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[20px] font-black tracking-tight leading-tight ${c.accentText}`}>
            {c.label}
          </p>
          {activeCount > 0 && (
            <p className="text-[12px] text-foreground/50 mt-1 font-semibold">
              {activeCount} permit{activeCount !== 1 ? "s" : ""} tracked
            </p>
          )}
        </div>
      </div>

      {/* Details — only show "Found" info, no scan timestamp */}
      <div className="pt-4 border-t border-border/30">
        {scannerState === "starting" && (
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-muted-foreground/30" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
            </span>
            <p className="text-[12px] text-foreground/50 leading-snug font-bold">
              Waiting for first scan…
            </p>
          </div>
        )}

        {scannerState === "error" && (
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={13} className="text-status-peak shrink-0" />
            <p className="text-[12px] text-status-peak leading-snug font-bold">
              Scanner encountered an error
            </p>
          </div>
        )}

        {scannerState === "delayed" && (
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={13} className="text-status-busy shrink-0" />
            <p className="text-[12px] text-status-busy leading-snug font-bold">
              Scanner may be delayed — retrying automatically
            </p>
          </div>
        )}

        {(scannerState === "active" || scannerState === "paused") && lastFound && (
          <div className="flex items-center gap-2.5">
            <Zap size={13} className="text-status-found shrink-0" />
            <p className="text-[12px] leading-snug font-bold text-foreground">
              Found {getTimeAgo(lastFound)}
            </p>
          </div>
        )}

        {(scannerState === "active" || scannerState === "paused") && !lastFound && (
          <div className="flex items-center gap-2.5">
            <p className="text-[12px] text-foreground/40 leading-snug font-bold">
              Monitoring for cancellations
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ScannerStatusCard;
