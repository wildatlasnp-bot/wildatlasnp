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
      className={`rounded-xl border p-5 ${bgAccent}`}
    >
      {/* Header */}
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground/60 mb-3">
        Permit Scanner Status
      </p>

      {/* Scanner status row */}
      <div className="flex items-center gap-3 mb-4">
        <span className="relative flex h-3.5 w-3.5 shrink-0">
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
          <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${dotColor}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-extrabold tracking-tight ${accentColor}`}>
            {statusLabel}
          </p>
          {activeCount > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {activeCount} permit{activeCount !== 1 ? "s" : ""} being tracked
            </p>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-2">
          <Clock size={12} className="text-foreground/50 shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground/70 leading-snug font-semibold">
            {lastScanText}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Zap size={12} className={`shrink-0 mt-0.5 ${lastFound ? "text-status-found" : "text-foreground/50"}`} />
          <p className={`text-[11px] leading-snug font-semibold ${lastFound ? "text-foreground" : "text-foreground/70"}`}>
            {lastFindText}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ScannerStatusCard;
