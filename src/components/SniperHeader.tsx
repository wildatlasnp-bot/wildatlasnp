import { RefreshCw } from "lucide-react";
import { type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  activeCount: number;
  scannerState: ScannerState;
  refreshing: boolean;
  onRefresh: () => void;
}

const SniperHeader = ({
  activeCount, scannerState, refreshing, onRefresh,
}: SniperHeaderProps) => {
  return (
    <div className="px-5 pt-4 pb-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          All Parks
          {activeCount > 0 && (
            <span className="ml-1.5 text-secondary">· {activeCount} tracked</span>
          )}
        </span>
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
    </div>
  );
};

export default SniperHeader;
