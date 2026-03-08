import { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { supabase } from "@/integrations/supabase/client";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { SCANNER_STATE_LABELS, type ScannerState } from "@/lib/scanner-status";

interface ParkStatusHeaderProps {
  parkId: string;
}

type CrowdStatus = "Quiet" | "Moderate" | "Busy" | "Very Busy" | "—";

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

const scannerVisual: Record<ScannerState, { dotClass: string; ping: boolean; pulse: boolean }> = {
  active: { dotClass: "bg-status-scanning", ping: true, pulse: false },
  delayed: { dotClass: "bg-status-peak", ping: false, pulse: true },
  starting: { dotClass: "bg-muted-foreground/50", ping: false, pulse: true },
  paused: { dotClass: "bg-muted-foreground/50", ping: false, pulse: false },
  error: { dotClass: "bg-status-peak", ping: false, pulse: true },
};

const scannerTextColor: Record<ScannerState, string> = {
  active: "text-status-scanning",
  delayed: "text-status-peak",
  starting: "text-muted-foreground",
  paused: "text-muted-foreground",
  error: "text-status-peak",
};

const ParkStatusHeader = ({ parkId }: ParkStatusHeaderProps) => {
  const [crowdData, setCrowdData] = useState<{
    location: string;
    quietStart: string;
    quietEnd: string;
    peakStart: string;
    peakEnd: string;
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
      .select("location_name, quiet_start, quiet_end, peak_start, peak_end, evening_quiet")
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
            peakEnd: data[0].peak_end,
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
    const peakEnd = toMinutes(crowdData.peakEnd);
    const eveningQuiet = toMinutes(crowdData.eveningQuiet);
    if (nowMin < quietEnd) return { level: "Quiet", color: "text-[#4CAF50]", dot: "bg-[#4CAF50]" };
    if (nowMin < peakStart) return { level: "Moderate", color: "text-[#2196F3]", dot: "bg-[#2196F3]" };
    if (nowMin >= peakStart && nowMin < peakEnd) return { level: "Very Busy", color: "text-[#E53935]", dot: "bg-[#E53935]" };
    if (nowMin >= eveningQuiet) return { level: "Quiet", color: "text-[#4CAF50]", dot: "bg-[#4CAF50]" };
    return { level: "Busy", color: "text-[#E6A23C]", dot: "bg-[#E6A23C]" };
  }, [crowdData]);

  const sv = scannerVisual[scannerState];
  const scannerLabel = SCANNER_STATE_LABELS[scannerState];
  const scannerColor = scannerTextColor[scannerState];

  // Build timestamp suffix
  const showTimestamp = (scannerState === "active" || scannerState === "delayed") && lastSuccessfulScanAt;
  const timestampText = showTimestamp ? `Last check ${getTimeAgo(lastSuccessfulScanAt!)}` : scannerState === "starting" ? "Waiting for first check" : "";

  return (
    <div className="mx-5 mt-3 mb-1 rounded-xl border border-border/70 bg-card px-4 py-4" style={{ boxShadow: "var(--card-shadow)" }}>
      {/* Park name */}
      <h2 className="text-[18px] font-semibold text-foreground font-body leading-snug mb-2.5">{park.name}</h2>

      {/* Scanner status — primary signal */}
      <div className="flex items-center gap-2.5 mb-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {sv.ping && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sv.dotClass} opacity-50`} style={{ animationDuration: "1.8s" }} />
          )}
          {sv.pulse && (
            <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${sv.dotClass} opacity-40`} />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${sv.dotClass}`} />
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[12px] font-bold ${scannerColor}`}>{scannerLabel}</span>
          {timestampText && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Clock size={9} className="shrink-0" />
                {timestampText}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Crowd level — calm advisory indicator */}
      <div className="flex items-center gap-1.5 pl-[18px]">
        <span className={`w-2 h-2 rounded-full shrink-0 ${crowdStatus.dot}`} />
        <span className="text-[14px] font-normal font-body text-[#333333]">
          Crowds: <span className={`font-medium ${crowdStatus.color}`}>{crowdStatus.level}</span>
        </span>
      </div>
    </div>
  );
};

export default ParkStatusHeader;
