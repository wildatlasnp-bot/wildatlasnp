import { Clock, Zap, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface ScannerStatusCardProps {
  scannerStatus: "active" | "delayed" | "unknown";
  lastChecked: string | null;
  lastFound: string | null;
  activeCount: number;
  getTimeAgo: (dateStr: string) => string;
}

/**
 * Mutually exclusive states:
 * 1. NO_SCAN    – no scan completed yet → "Waiting for first scan…" + pulsing grey dot
 * 2. SCANNED    – scans running, no find → "Last scanned: Xm ago" only
 * 3. FOUND      – scans running + find  → "Last scanned" + "Found Xh ago"
 * 4. DELAYED    – heartbeat >10 min old → yellow warning
 */
type CardState = "NO_SCAN" | "SCANNED" | "FOUND" | "DELAYED";

function deriveState(
  scannerStatus: "active" | "delayed" | "unknown",
  lastChecked: string | null,
  lastFound: string | null,
): CardState {
  if (scannerStatus === "delayed") return "DELAYED";
  if (!lastChecked) return "NO_SCAN";
  if (lastFound) return "FOUND";
  return "SCANNED";
}

const ScannerStatusCard = ({
  scannerStatus,
  lastChecked,
  lastFound,
  activeCount,
  getTimeAgo,
}: ScannerStatusCardProps) => {
  const state = deriveState(scannerStatus, lastChecked, lastFound);

  // Visual config per state
  const config = {
    NO_SCAN: {
      label: "Connecting to scanner…",
      accentText: "text-muted-foreground",
      bgBorder: "bg-muted/30 border-border/40",
      dotColor: "bg-muted-foreground/40",
      ping: false,
      pulse: true,
    },
    SCANNED: {
      label: "Monitoring for cancellations",
      accentText: "text-status-quiet",
      bgBorder: "bg-status-quiet/8 border-status-quiet/20",
      dotColor: "bg-status-quiet",
      ping: true,
      pulse: false,
    },
    FOUND: {
      label: "Monitoring for cancellations",
      accentText: "text-status-quiet",
      bgBorder: "bg-status-quiet/8 border-status-quiet/20",
      dotColor: "bg-status-quiet",
      ping: true,
      pulse: false,
    },
    DELAYED: {
      label: "Scanner may be delayed — checking now",
      accentText: "text-status-busy",
      bgBorder: "bg-status-busy/8 border-status-busy/20",
      dotColor: "bg-status-busy",
      ping: false,
      pulse: true,
    },
  }[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border p-5 ${config.bgBorder}`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {/* Header */}
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-foreground/40 mb-3">
        System Status
      </p>

      {/* Scanner status row */}
      <div className="flex items-center gap-3.5 mb-5">
        <span className="relative flex h-5 w-5 shrink-0">
          {config.ping && (
            <>
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-40`}
                style={{ animationDuration: "1.6s" }}
              />
              <span
                className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-20`}
                style={{ animationDuration: "2.4s" }}
              />
            </>
          )}
          {config.pulse && !config.ping && (
            <span
              className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-40`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-5 w-5 ${config.dotColor} ring-2 ring-background`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[20px] font-black tracking-tight leading-tight ${config.accentText}`}>
            {config.label}
          </p>
          {activeCount > 0 && (
            <p className="text-[12px] text-foreground/50 mt-1 font-semibold">
              {activeCount} permit{activeCount !== 1 ? "s" : ""} tracked
            </p>
          )}
        </div>
      </div>

      {/* Details grid — content depends on state */}
      <div className="pt-4 border-t border-border/30">
        {state === "NO_SCAN" && (
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-muted-foreground/30" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
            </span>
            <p className="text-[12px] text-foreground/50 leading-snug font-bold">
              Waiting for first scan…
            </p>
          </div>
        )}

        {state === "SCANNED" && lastChecked && (
          <div className="flex items-center gap-2.5">
            <Clock size={13} className="text-foreground/30 shrink-0" />
            <p className="text-[12px] text-foreground/65 leading-snug font-bold">
              Last scanned: {getTimeAgo(lastChecked)}
            </p>
          </div>
        )}

        {state === "FOUND" && lastChecked && lastFound && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2.5">
              <Clock size={13} className="text-foreground/30 shrink-0" />
              <p className="text-[12px] text-foreground/65 leading-snug font-bold">
                Last scanned: {getTimeAgo(lastChecked)}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Zap size={13} className="text-status-found shrink-0" />
              <p className="text-[12px] leading-snug font-bold text-foreground">
                Found {getTimeAgo(lastFound)}
              </p>
            </div>
          </div>
        )}

        {state === "DELAYED" && (
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={13} className="text-status-busy shrink-0" />
            <p className="text-[12px] text-status-busy leading-snug font-bold">
              Last response over 10 minutes ago
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ScannerStatusCard;