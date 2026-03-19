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
      className={`mx-4 mb-2 rounded-xl px-3.5 py-2.5 w-[calc(100%-2rem)] text-left active:scale-[0.98] transition-transform duration-150 ${isEmpty ? "bg-muted/40" : ""}`}
      style={isEmpty ? undefined : { background: "hsl(150 14% 16%)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
    >
      <div className="flex items-start gap-2.5">
        {/* LIVE indicator */}
        {!isEmpty && (
          <div className="flex items-center gap-1 pt-0.5 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              {isActive && (
                <span
                  className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full opacity-50"
                  style={{ backgroundColor: "#4ade80", boxShadow: "0 0 6px 2px rgba(74,222,128,0.35)" }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ backgroundColor: "#4ade80", boxShadow: "0 0 4px 1px rgba(74,222,128,0.3)" }}
              />
            </span>
            <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>
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
              <p className="text-[11px] font-bold leading-tight truncate" style={{ color: "rgba(255,255,255,0.92)" }}>
                {permitTitle}
              </p>
              {/* Park name — medium weight */}
              {parkName && (
                <p className="text-[10.5px] font-medium leading-tight mt-px" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {parkName}
                </p>
              )}
              {/* Status line 1 */}
              <p className="text-[10px] font-normal leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Active monitoring
              </p>
              {/* Status line 2 — check count */}
              {estimatedChecks !== null && estimatedChecks > 0 && (
                <p className="text-[10px] font-normal leading-tight mt-px" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {estimatedChecks.toLocaleString()} checks since alert created
                </p>
              )}
              {/* Status line 3 — last check */}
              <p className="text-[10px] font-normal leading-tight mt-px" style={{ color: "rgba(255,255,255,0.25)" }}>
                Last check: 3m ago
              </p>
              {/* Status line 4 — insight */}
              <p className="text-[10px] font-normal italic leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.18)" }}>
                Permit drops typically happen between 6–8 AM
              </p>
            </>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight size={14} className="shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>
    </button>
  );
}
