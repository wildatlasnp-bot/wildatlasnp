import { Clock, Zap } from "lucide-react";
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
    ? `Checked ${getTimeAgo(lastChecked)}`
    : "Waiting for first scan…";

  const lastFindText = lastFound
    ? `Found ${getTimeAgo(lastFound)}`
    : "No finds yet";

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
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {/* Header */}
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-foreground/40 mb-3">
        System Status
      </p>

      {/* Scanner status row */}
      <div className="flex items-center gap-3.5 mb-5">
        <span className="relative flex h-5 w-5 shrink-0">
          {isActive && (
            <>
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-40`}
                style={{ animationDuration: "1.6s" }}
              />
              <span
                className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-20`}
                style={{ animationDuration: "2.4s" }}
              />
            </>
          )}
          {isDelayed && (
            <span
              className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-40`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-5 w-5 ${dotColor} ring-2 ring-background`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[20px] font-black tracking-tight leading-tight ${accentColor}`}>
            {statusLabel}
          </p>
          {activeCount > 0 && (
            <p className="text-[12px] text-foreground/50 mt-1 font-semibold">
              {activeCount} permit{activeCount !== 1 ? "s" : ""} tracked
            </p>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
        <div className="flex items-center gap-2.5">
          <Clock size={13} className="text-foreground/30 shrink-0" />
          <p className="text-[12px] text-foreground/65 leading-snug font-bold">
            {lastScanText}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Zap size={13} className={`shrink-0 ${lastFound ? "text-status-found" : "text-foreground/30"}`} />
          <p className={`text-[12px] leading-snug font-bold ${lastFound ? "text-foreground" : "text-foreground/65"}`}>
            {lastFindText}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ScannerStatusCard;