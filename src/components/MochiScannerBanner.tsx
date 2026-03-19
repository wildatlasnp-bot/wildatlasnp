import { useState, useEffect } from "react";
import { Radar, ChevronRight } from "lucide-react";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { PARKS } from "@/lib/parks";

interface TrackedPermitInfo {
  permit_name: string;
  park_id: string;
  created_at?: string;
}

const SCAN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function MochiScannerBanner({
  trackedPermits,
  onTap,
}: {
  trackedPermits: TrackedPermitInfo[];
  onTap?: () => void;
}) {
  const { scannerState } = useScannerStatus();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Estimate total checks since earliest watch was created
  const estimatedChecks = (() => {
    const earliest = trackedPermits.reduce<number | null>((min, p) => {
      if (!p.created_at) return min;
      const t = new Date(p.created_at).getTime();
      return min === null ? t : Math.min(min, t);
    }, null);
    if (earliest === null) return null;
    const elapsedMs = Math.max(0, now - earliest);
    return Math.floor(elapsedMs / SCAN_INTERVAL_MS);
  })();

  // Build permit title and park name separately for typography hierarchy
  let permitTitle: string;
  let parkName: string;
  if (trackedPermits.length === 0) {
    permitTitle = "Mochi is ready to watch permits for you";
    parkName = "";
  } else if (trackedPermits.length === 1) {
    const p = trackedPermits[0];
    permitTitle = p.permit_name;
    parkName = PARKS[p.park_id]?.shortName || "your park";
  } else {
    const parkIds = [...new Set(trackedPermits.map((p) => p.park_id))];
    permitTitle = `${trackedPermits.length} permits`;
    parkName =
      parkIds.length === 1
        ? PARKS[parkIds[0]]?.shortName || "1 park"
        : `${parkIds.length} parks`;
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
      <div className="flex items-start gap-2.5">
        {/* LIVE indicator */}
        {!isEmpty && (
          <div className="flex items-center gap-1 pt-0.5 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              {isActive && (
                <span
                  className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-40"
                />
              )}
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-scanning" />
            </span>
            <span className="text-[9px] font-medium tracking-wider text-muted-foreground/50 uppercase">
              Live
            </span>
          </div>
        )}
        {isEmpty && <Radar size={13} className="text-muted-foreground/50 shrink-0 mt-0.5" />}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {isEmpty ? (
            <p className="text-[11px] font-medium leading-tight truncate text-muted-foreground/60">
              {permitTitle}
            </p>
          ) : (
            <>
              {/* Permit title — heaviest weight */}
              <p className="text-[11px] font-bold leading-tight truncate text-foreground/90">
                {permitTitle}
              </p>
              {/* Park name — medium weight */}
              {parkName && (
                <p className="text-[10.5px] font-medium leading-tight text-foreground/60 mt-px">
                  {parkName}
                </p>
              )}
              {/* Status line — lightest weight */}
              <p className="text-[10px] font-normal leading-tight text-muted-foreground/50 mt-0.5">
                Active — checking every 2 min
              </p>
              {/* Check count — secondary line inserted below status */}
              {estimatedChecks !== null && estimatedChecks > 0 && (
                <p className="text-[10px] font-normal leading-tight text-muted-foreground/40 mt-px">
                  {estimatedChecks.toLocaleString()} checks since alert created
                </p>
              )}
            </>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 mt-0.5" />
      </div>
    </button>
  );
}
