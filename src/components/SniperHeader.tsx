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
        <span className="text-[12px] font-semibold text-foreground/65 font-body">
          Permit Scanner
        </span>
        <span className={`text-[12px] font-normal ${isDelayed ? "text-status-busy" : isActive ? "text-status-quiet" : "text-muted-foreground"}`}>
          · {SCANNER_STATE_LABELS[scannerState]}
        </span>
        {lastChecked && (
          <span className="text-[12px] font-normal text-foreground/65">
            · {getTimeAgo(lastChecked)}
          </span>
        )}
      </div>
      <p className="type-meta ml-4 font-medium">
        {activeCount > 0
          ? `Monitoring ${activeCount} permit${activeCount !== 1 ? "s" : ""}${trackedParkCount > 1 ? ` across ${trackedParkCount} parks` : ""}`
          : "No permits being monitored"
        }
      </p>
    </div>
  );
};

export default SniperHeader;
