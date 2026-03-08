import { RefreshCw } from "lucide-react";
import ParkSelector from "@/components/ParkSelector";
import { type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  parkId: string;
  activeCount: number;
  scannerState: ScannerState;
  refreshing: boolean;
  onParkChange: (id: string) => void;
  onRefresh: () => void;
}

const SniperHeader = ({
  parkId, activeCount, scannerState, refreshing,
  onParkChange, onRefresh,
}: SniperHeaderProps) => {
  return (
    <div className="px-5 pt-4 pb-2">
      {/* Park selector + refresh */}
      <div className="flex items-center justify-between">
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
    </div>
  );
};

export default SniperHeader;
