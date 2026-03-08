import { type ScannerState } from "@/lib/scanner-status";
import { SCANNER_STATE_LABELS } from "@/lib/scanner-status";
import { Radio } from "lucide-react";

interface SniperHeaderProps {
  activeCount: number;
  scannerState: ScannerState;
  lastChecked: string | null;
  trackedParkCount: number;
  getTimeAgo: (dateStr: string) => string;
}

const SniperHeader = ({
  activeCount,
  scannerState,
  lastChecked,
  trackedParkCount,
  getTimeAgo,
}: SniperHeaderProps) => {
  const isActive = scannerState === "active";
  const isDelayed = scannerState === "delayed";
  const dotColor = isDelayed ? "bg-status-busy" : isActive ? "bg-status-quiet" : "bg-muted-foreground";

  return (
    <div className="px-5 pt-4 pb-3">
      {/* Scanner status — global scope */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-flex rounded-full h-2 w-2 shrink-0 ${dotColor} ${isActive ? "scanner-dot-heartbeat" : ""}`} />
        <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">
          Permit Scanner
        </span>
        <span className={`text-[10px] font-semibold ${isDelayed ? "text-status-busy" : isActive ? "text-status-quiet" : "text-muted-foreground"}`}>
          · {SCANNER_STATE_LABELS[scannerState]}
        </span>
        {lastChecked && (
          <span className="type-meta font-medium">
            · {getTimeAgo(lastChecked)}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 ml-4 font-medium">
        {activeCount > 0
          ? `Monitoring ${activeCount} permit${activeCount !== 1 ? "s" : ""}${trackedParkCount > 1 ? ` across ${trackedParkCount} parks` : ""}`
          : "No permits being monitored"
        }
      </p>
    </div>
  );
};

export default SniperHeader;
