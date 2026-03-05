import { Clock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import ParkSelector from "@/components/ParkSelector";

interface SniperHeaderProps {
  parkId: string;
  activeCount: number;
  lastChecked: string | null;
  scanPulse: boolean;
  refreshing: boolean;
  getTimeAgo: (dateStr: string) => string;
  onParkChange: (id: string) => void;
  onRefresh: () => void;
}

const SniperHeader = ({
  parkId, activeCount, lastChecked, scanPulse, refreshing,
  getTimeAgo, onParkChange, onRefresh,
}: SniperHeaderProps) => {
  const isActive = activeCount > 0;

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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-50" style={{ animationDuration: "2s" }} />
                <span className="absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-20" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-scanning ring-2 ring-background" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-foreground tracking-tight">Scanner Running</p>
                <p className="text-[11px] text-muted-foreground">Monitoring cancellations · {activeCount} permit{activeCount !== 1 ? "s" : ""}</p>
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
                <p className="text-[11px] text-muted-foreground">Add a watch to start monitoring</p>
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
        <p className="text-[10px] text-muted-foreground mt-2 ml-[26px]">
          We check Recreation.gov for cancellations throughout the day.
        </p>
      </div>
    </div>
  );
};

export default SniperHeader;
