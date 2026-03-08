import { useState, useEffect, useMemo } from "react";
import { PARKS } from "@/lib/parks";
import { supabase } from "@/integrations/supabase/client";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { type ScannerState } from "@/lib/scanner-status";

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

  // Build timestamp suffix
  const showTimestamp = (scannerState === "active" || scannerState === "delayed") && lastSuccessfulScanAt;
  const timestampSuffix = showTimestamp ? ` • Last check ${getTimeAgo(lastSuccessfulScanAt!)}` : "";

  const statusLabel = scannerState === "active" ? "Scanner running" 
    : scannerState === "delayed" ? "Scanner delayed"
    : scannerState === "starting" ? "Scanner starting"
    : scannerState === "paused" ? "Scanner paused"
    : "Scanner error";

  return (
    <div className="mx-5 mt-4 mb-2 rounded-xl border border-border/40 bg-card px-5 py-5" style={{ boxShadow: "var(--card-shadow)" }}>
      {/* Park name */}
      <h2 className="text-[18px] font-semibold text-foreground font-body leading-snug mb-2">{park.name}</h2>

      {/* Single scanner status line */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2 shrink-0">
          {sv.ping && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sv.dotClass} opacity-50`} style={{ animationDuration: "1.8s" }} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${sv.dotClass}`} />
        </span>
        <span className="text-[13px] font-normal text-foreground/65 font-body">
          {statusLabel}{timestampSuffix}
        </span>
      </div>

      {/* Crowd level */}
      <div className="flex items-center gap-1.5 pl-4">
        <span className={`w-2 h-2 rounded-full shrink-0 ${crowdStatus.dot}`} />
        <span className="text-[13px] font-normal font-body text-foreground/65">
          Crowds: <span className={`font-medium ${crowdStatus.color}`}>{crowdStatus.level}</span>
        </span>
      </div>
    </div>
  );
};

export default ParkStatusHeader;
