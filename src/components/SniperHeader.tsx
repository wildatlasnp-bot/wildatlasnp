import { Clock, RefreshCw, AlertTriangle, Activity, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ParkSelector from "@/components/ParkSelector";

interface SniperHeaderProps {
  parkId: string;
  activeCount: number;
  lastChecked: string | null;
  scanPulse: boolean;
  refreshing: boolean;
  scannerStale: boolean;
  scannerStatus: "active" | "delayed" | "unknown";
  getTimeAgo: (dateStr: string) => string;
  onParkChange: (id: string) => void;
  onRefresh: () => void;
}

const statusConfig = {
  active: {
    dotClass: "bg-status-scanning",
    pingClass: "bg-status-scanning",
    label: "Scanner running",
    subtitle: "Checking Recreation.gov for cancellations",
    badgeClass: "text-status-scanning bg-status-scanning/10 border-status-scanning/20",
    badgeLabel: "Live",
  },
  delayed: {
    dotClass: "bg-status-busy",
    pingClass: "bg-status-busy",
    label: "Scanner delayed",
    subtitle: "Last scan was over 10 minutes ago — data may be stale",
    badgeClass: "text-status-busy bg-status-busy/10 border-status-busy/20",
    badgeLabel: "Delayed",
  },
  unknown: {
    dotClass: "bg-muted-foreground/50",
    pingClass: "bg-muted-foreground/30",
    label: "Scanner connecting",
    subtitle: "Waiting for scanner heartbeat…",
    badgeClass: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
    badgeLabel: "Unknown",
  },
} as const;

const SniperHeader = ({
  parkId, activeCount, lastChecked, scanPulse, refreshing, scannerStale, scannerStatus,
  getTimeAgo, onParkChange, onRefresh,
}: SniperHeaderProps) => {
  const isActive = activeCount > 0;
  const cfg = statusConfig[scannerStatus];

  return (
    <div className="px-5 pt-3 pb-1">
      {/* Park selector + refresh */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Scanner status — large, prominent */}
      <div className="mb-1">
        <div className="flex items-center gap-3">
          {isActive ? (
            <>
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                {scannerStatus === "active" && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.pingClass} opacity-50`} style={{ animationDuration: "2s" }} />
                )}
                <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dotClass} opacity-20`} />
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${cfg.dotClass} ring-2 ring-background`} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-foreground tracking-tight">{cfg.label}</p>
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                    {cfg.badgeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {cfg.subtitle} · {activeCount} permit{activeCount !== 1 ? "s" : ""}
                </p>
                {lastChecked && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                    <Clock size={9} className="shrink-0" />
                    Last scan: {getTimeAgo(lastChecked)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-status-building opacity-30" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-building/60" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-foreground tracking-tight">Scanner Ready</p>
                <p className="text-[11px] text-muted-foreground">Add a watch to start monitoring Recreation.gov</p>
              </div>
            </>
          )}
          {lastChecked && (
            <motion.span
              key={lastChecked}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              className={`text-[9px] font-semibold shrink-0 flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                scanPulse ? "text-status-scanning bg-status-scanning/10" : "text-muted-foreground bg-muted/50"
              }`}
            >
              <Clock size={8} />
              {getTimeAgo(lastChecked)}
            </motion.span>
          )}
        </div>

        <AnimatePresence>
          {scannerStale && isActive && scannerStatus === "delayed" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 mt-2 ml-[26px] px-2.5 py-1.5 rounded-lg bg-status-busy/10 border border-status-busy/20"
            >
              <AlertTriangle size={11} className="text-status-busy shrink-0" />
              <p className="text-[10px] text-status-busy font-medium">
                Scanner may be delayed — we're retrying automatically
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!scannerStale && isActive && (
          <p className="text-[10px] text-muted-foreground mt-2 ml-[26px]">
            We check Recreation.gov for cancellations throughout the day.
          </p>
        )}
        {!isActive && (
          <p className="text-[10px] text-muted-foreground mt-2 ml-[26px]">
            We check Recreation.gov for cancellations throughout the day.
          </p>
        )}
      </div>
    </div>
  );
};

export default SniperHeader;
