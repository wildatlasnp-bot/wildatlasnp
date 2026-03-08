import { useState, useEffect, useMemo } from "react";
import { Activity, Clock } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { supabase } from "@/integrations/supabase/client";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { SCANNER_STATE_LABELS, type ScannerState } from "@/lib/scanner-status";

interface ParkStatusHeaderProps {
  parkId: string;
}

type CrowdStatus = "QUIET" | "MODERATE" | "BUSY" | "—";

function toMinutes(t: string) {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hr = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && hr !== 12) hr += 12;
  if (ampm === "AM" && hr === 12) hr = 0;
  return hr * 60 + min;
}

const ParkStatusHeader = ({ parkId }: ParkStatusHeaderProps) => {
  const [crowdData, setCrowdData] = useState<{
    location: string;
    quietStart: string;
    quietEnd: string;
    peakStart: string;
    eveningQuiet: string;
  } | null>(null);

  const { scannerState, lastSuccessfulScanAt, getTimeAgo } = useScannerStatus();

  const park = PARKS[parkId] ?? PARKS.yosemite;

  // Fetch crowd forecast (first location)
  useEffect(() => {
    const now = new Date();
    const dayType = now.getDay() === 0 || now.getDay() === 6 ? "weekend" : "weekday";
    const month = now.getMonth();
    const season = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "fall" : "winter";

    supabase
      .from("park_crowd_forecasts")
      .select("location_name, quiet_start, quiet_end, peak_start, evening_quiet")
      .eq("park_id", parkId)
      .eq("season", season)
      .eq("day_type", dayType)
      .order("location_name")
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setCrowdData({
            location: data[0].location_name,
            quietStart: data[0].quiet_start,
            quietEnd: data[0].quiet_end,
            peakStart: data[0].peak_start,
            eveningQuiet: data[0].evening_quiet,
          });
        } else {
          setCrowdData(null);
        }
      });
  }, [parkId]);

  const crowdStatus: { level: CrowdStatus; color: string; dot: string } = useMemo(() => {
    if (!crowdData) return { level: "—", color: "text-muted-foreground", dot: "bg-muted-foreground" };
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const quietEnd = toMinutes(crowdData.quietEnd);
    const peakStart = toMinutes(crowdData.peakStart);
    const eveningQuiet = toMinutes(crowdData.eveningQuiet);
    if (nowMin < quietEnd) return { level: "QUIET", color: "text-status-quiet", dot: "bg-status-quiet" };
    if (nowMin < peakStart) return { level: "MODERATE", color: "text-status-building", dot: "bg-status-building" };
    if (nowMin >= eveningQuiet) return { level: "QUIET", color: "text-status-quiet", dot: "bg-status-quiet" };
    return { level: "BUSY", color: "text-status-peak", dot: "bg-status-peak" };
  }, [crowdData]);

  // Scanner visual config
  const scannerVisual: Record<ScannerState, { dotClass: string; iconClass: string; showTimestamp: boolean }> = {
    active: { dotClass: "text-status-scanning", iconClass: "text-status-scanning", showTimestamp: true },
    delayed: { dotClass: "text-status-peak", iconClass: "text-status-peak animate-pulse", showTimestamp: true },
    starting: { dotClass: "text-muted-foreground", iconClass: "text-muted-foreground animate-pulse", showTimestamp: false },
    paused: { dotClass: "text-muted-foreground", iconClass: "text-muted-foreground", showTimestamp: false },
    error: { dotClass: "text-status-peak", iconClass: "text-status-peak", showTimestamp: false },
  };

  const sv = scannerVisual[scannerState];
  const scannerLabel = SCANNER_STATE_LABELS[scannerState];

  // Build the timestamp suffix
  const timestampSuffix = sv.showTimestamp && lastSuccessfulScanAt
    ? ` · Last check ${getTimeAgo(lastSuccessfulScanAt)}`
    : scannerState === "starting"
    ? " · Waiting for first check"
    : "";

  return (
    <div className="mx-5 mt-3 mb-1 rounded-xl border border-border/70 bg-card px-4 py-4" style={{ boxShadow: "var(--card-shadow)" }}>
      {/* Park name */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold text-foreground font-body tracking-tight leading-snug">{park.name}</h2>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-5 flex-wrap">
        {/* 1. Current crowd level */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${crowdStatus.dot}${crowdStatus.level === "QUIET" ? " status-dot-pulse" : crowdStatus.level === "BUSY" ? " animate-pulse" : ""}`} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">Crowds</span>
              <span className={`text-[13px] font-black ${crowdStatus.color}`}>{crowdStatus.level}</span>
            </div>
            <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider leading-none">Now</span>
          </div>
        </div>

        {/* Divider */}
        <span className="w-px h-3.5 bg-border/60" />

        {/* 2. Scanner health — single source of truth timestamp */}
        <div className="flex items-center gap-2">
          <Activity size={9} className={sv.iconClass} />
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${sv.dotClass}`}>
              {scannerLabel}
            </span>
            {timestampSuffix && (
              <span className="text-[11px] font-medium text-muted-foreground leading-tight flex items-center gap-1">
                <Clock size={8} className="shrink-0" />
                {timestampSuffix.replace(" · ", "")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParkStatusHeader;
