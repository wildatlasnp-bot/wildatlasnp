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
  return (
    <div className="px-5 pt-3 pb-2">
      {/* Top row: park selector + refresh */}
      <div className="flex items-center justify-between mb-2">
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

      {/* Scanner status bar */}
      <div className={`flex items-center gap-2.5 px-1 py-2 transition-colors ${
        activeCount > 0
          ? ""
          : ""
      }`}>
        {activeCount > 0 ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground">
                Scanner active · {activeCount} watch{activeCount !== 1 ? "es" : ""}
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <p className="text-[11px] font-medium text-muted-foreground">No active watches</p>
          </>
        )}
        {lastChecked && (
          <motion.span
            key={lastChecked}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className={`text-[9px] font-medium shrink-0 flex items-center gap-1 transition-colors ${
              scanPulse ? "text-status-scanning" : "text-muted-foreground"
            }`}
          >
            <Clock size={8} />
            {getTimeAgo(lastChecked)}
          </motion.span>
        )}
      </div>
    </div>
  );
};

export default SniperHeader;
