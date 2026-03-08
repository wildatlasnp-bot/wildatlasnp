import { type ScannerState } from "@/lib/scanner-status";

interface SniperHeaderProps {
  activeCount: number;
  scannerState: ScannerState;
  refreshing: boolean;
  onRefresh: () => void;
}

const SniperHeader = ({
  activeCount,
}: SniperHeaderProps) => {
  return (
    <div className="px-5 pt-4 pb-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        All Parks
        {activeCount > 0 && (
          <span className="ml-1.5 text-secondary">· {activeCount} tracked</span>
        )}
      </span>
    </div>
  );
};

export default SniperHeader;
