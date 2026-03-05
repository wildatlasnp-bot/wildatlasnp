import { Radar, Clock, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface ScannerStatusCardProps {
  scannerStatus: "active" | "delayed" | "unknown";
  lastChecked: string | null;
  lastFound: string | null;
  activeCount: number;
  getTimeAgo: (dateStr: string) => string;
}

const ScannerStatusCard = ({
  scannerStatus,
  lastChecked,
  lastFound,
  activeCount,
  getTimeAgo,
}: ScannerStatusCardProps) => {
  const isActive = scannerStatus === "active";
  const isDelayed = scannerStatus === "delayed";

  const statusLabel = isActive
    ? "Monitoring for cancellations"
    : isDelayed
    ? "Scanner may be delayed"
    : "Connecting to scanner…";

  const lastScanText = lastChecked
    ? `Last checked ${getTimeAgo(lastChecked)}`
    : "Waiting for first scan…";

  const lastFindText = lastFound
    ? `Last permit found ${getTimeAgo(lastFound)}`
    : "No recent finds yet";

  const accentColor = isDelayed
    ? "text-status-busy"
    : "text-status-quiet";

  const bgAccent = isDelayed
    ? "bg-status-busy/8 border-status-busy/20"
    : "bg-status-quiet/8 border-status-quiet/20";

  const dotColor = isDelayed
    ? "bg-status-busy"
    : "bg-status-quiet";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border p-4 ${bgAccent}`}
    >
      {/* Header */}
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Permit Scanner Status
      </p>

      {/* Scanner status row */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="relative flex h-3 w-3 shrink-0">
          {isActive && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-40`}
              style={{ animationDuration: "2s" }}
            />
          )}
          {isDelayed && (
            <span
              className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-40`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-bold tracking-tight ${accentColor}`}>
            {statusLabel}
          </p>
          {activeCount > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeCount} permit{activeCount !== 1 ? "s" : ""} being tracked
            </p>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Clock size={12} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-snug font-medium">
            {lastScanText}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Zap size={12} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-snug font-medium">
            {lastFindText}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ScannerStatusCard;
