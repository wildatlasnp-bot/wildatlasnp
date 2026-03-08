import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ParkSelector from "@/components/ParkSelector";
import { SCANNER_STATE_LABELS, type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  parkId: string;
  activeCount: number;
  scannerState: ScannerState;
  refreshing: boolean;
  onParkChange: (id: string) => void;
  onRefresh: () => void;
}

const statusVisual: Record<ScannerState, {
  dotClass: string;
  pingClass: string;
  badgeClass: string;
  badgeLabel: string;
  subtitle: string;
}> = {
  active: {
    dotClass: "bg-status-scanning",
    pingClass: "bg-status-scanning",
    badgeClass: "text-status-scanning bg-status-scanning/10 border-status-scanning/20",
    badgeLabel: "Live",
    subtitle: "Checking Recreation.gov for cancellations",
  },
  delayed: {
    dotClass: "bg-status-busy",
    pingClass: "bg-status-busy",
    badgeClass: "text-status-busy bg-status-busy/10 border-status-busy/20",
    badgeLabel: "Delayed",
    subtitle: "Last scan was over 10 minutes ago — data may be stale",
  },
  starting: {
    dotClass: "bg-muted-foreground/50",
    pingClass: "bg-muted-foreground/30",
    badgeClass: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
    badgeLabel: "Starting",
    subtitle: "Waiting for scanner heartbeat…",
  },
  paused: {
    dotClass: "bg-muted-foreground/50",
    pingClass: "bg-muted-foreground/30",
    badgeClass: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
    badgeLabel: "Paused",
    subtitle: "Scanner is paused",
  },
  error: {
    dotClass: "bg-status-peak",
    pingClass: "bg-status-peak",
    badgeClass: "text-status-peak bg-status-peak/10 border-status-peak/20",
    badgeLabel: "Error",
    subtitle: "Scanner encountered an error",
  },
};

const SniperHeader = ({
  parkId, activeCount, scannerState, refreshing,
  onParkChange, onRefresh,
}: SniperHeaderProps) => {
  const isActive = activeCount > 0;
  const cfg = statusVisual[scannerState];

  return (
    <div className="px-5 pt-4 pb-2">
      {/* Park selector + refresh */}
      <div className="flex items-center justify-between mb-3.5">
        <ParkSelector activeParkId={parkId} onParkChange={onParkChange} />
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 uppercase tracking-wider"
          aria-label="Refresh availability"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {/* Scanner status — state label + badge, no timestamp */}
      <div className="mb-1">
        <div className="flex items-center gap-3">
          {isActive ? (
            <>
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                {scannerState === "active" && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.pingClass} opacity-50`} style={{ animationDuration: "2s" }} />
                )}
                <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dotClass} opacity-20`} />
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${cfg.dotClass} ring-2 ring-background`} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[18px] font-black text-foreground tracking-tight">
                    {SCANNER_STATE_LABELS[scannerState]}
                  </p>
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                    {cfg.badgeLabel}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground/60 font-medium mt-0.5">
                  {cfg.subtitle} · {activeCount} tracked
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-status-building opacity-30" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-building/60" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-black text-foreground tracking-tight">Ready to track</p>
                <p className="text-[12px] text-muted-foreground/60 font-medium">Add a permit below to start scanning</p>
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {isActive && scannerState === "delayed" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 mt-2 ml-[26px] px-2.5 py-1.5 rounded-lg bg-status-busy/10 border border-status-busy/20"
            >
              <span className="text-[10px] text-status-busy font-medium">
                Scanner may be delayed — we're retrying automatically
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SniperHeader;
