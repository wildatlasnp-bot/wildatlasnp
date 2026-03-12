import { useState, useEffect } from "react";
import { Radar, Clock, ChevronRight } from "lucide-react";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { PARKS } from "@/lib/parks";

interface TrackedPermitInfo {
  permit_name: string;
  park_id: string;
}

const SCAN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function MochiScannerBanner({
  trackedPermits,
  onTap,
}: {
  trackedPermits: TrackedPermitInfo[];
  onTap?: () => void;
}) {
  const { scannerState, lastSuccessfulScanAt } = useScannerStatus();
  const [now, setNow] = useState(Date.now());

  // Tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Compute time since last scan
  const lastScanAge = lastSuccessfulScanAt
    ? Math.max(0, Math.floor((now - new Date(lastSuccessfulScanAt).getTime()) / 1000))
    : null;

  // Compute next scan countdown
  const nextScanIn = lastScanAge !== null ? Math.max(0, 120 - lastScanAge) : null;

  const formatAge = (s: number): string => {
    if (s < 60) return "Just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} hr ago`;
  };

  // Build headline
  let headline: string;
  if (trackedPermits.length === 0) {
    headline = "Mochi is ready to watch permits for you";
  } else if (trackedPermits.length === 1) {
    const p = trackedPermits[0];
    const parkName = PARKS[p.park_id]?.shortName || "your park";
    headline = `Watching ${p.permit_name} · ${parkName}`;
  } else {
    const parkIds = [...new Set(trackedPermits.map((p) => p.park_id))];
    const parkLabel =
      parkIds.length === 1
        ? PARKS[parkIds[0]]?.shortName || "1 park"
        : `${parkIds.length} parks`;
    headline = `Watching ${trackedPermits.length} permits · ${parkLabel}`;
  }

  const isActive = scannerState === "active";
  const isEmpty = trackedPermits.length === 0;

  return (
    <button
      type="button"
      onClick={onTap}
      className={`mx-4 mb-2 rounded-xl px-3.5 py-2.5 w-[calc(100%-2rem)] text-left active:scale-[0.98] transition-transform duration-150 ${isEmpty ? "bg-muted/40" : "bg-card border border-border/50"}`}
      style={isEmpty ? undefined : { boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-2.5">
        {/* Status dot */}
        {!isEmpty && (
          <span className="relative flex h-2 w-2 shrink-0">
            {isActive && (
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-50"
                style={{ animationDuration: "1.6s" }}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isActive ? "bg-status-scanning" : scannerState === "error" ? "bg-destructive" : "bg-muted-foreground/40"
              }`}
            />
          </span>
        )}
        {isEmpty && <Radar size={13} className="text-muted-foreground/50 shrink-0" />}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-semibold leading-tight truncate ${isEmpty ? "text-muted-foreground/60" : "text-foreground/80"}`}>
            {headline}
          </p>
          {!isEmpty && lastScanAge !== null && (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-muted-foreground/60 font-medium flex items-center gap-1">
                <Clock size={9} className="shrink-0" />
                Last scan: {formatAge(lastScanAge)}
              </span>
              {nextScanIn !== null && nextScanIn > 0 && (
                <span className="text-[10px] text-muted-foreground/60 font-medium">
                  Next: {formatAge(nextScanIn)}
                </span>
              )}
              {nextScanIn === 0 && (
                <span className="text-[10px] text-status-scanning font-semibold">
                  Checking now…
                </span>
              )}
            </div>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
      </div>
    </button>
  );
}
