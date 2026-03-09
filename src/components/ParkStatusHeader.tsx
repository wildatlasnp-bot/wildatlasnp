import React, { useState, useEffect, useMemo } from "react";
import { PARKS } from "@/lib/parks";
import { supabase } from "@/integrations/supabase/client";

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

// In-memory cache per parkId
const headerCache = new Map<string, { location: string; quietStart: string; quietEnd: string; peakStart: string; peakEnd: string; eveningQuiet: string } | null>();

const ParkStatusHeader = React.memo(({ parkId }: ParkStatusHeaderProps) => {
  const [crowdData, setCrowdData] = useState<{
    location: string;
    quietStart: string;
    quietEnd: string;
    peakStart: string;
    peakEnd: string;
    eveningQuiet: string;
  } | null>(() => headerCache.get(parkId) ?? null);

  const park = PARKS[parkId] ?? PARKS.yosemite;

  useEffect(() => {
    if (headerCache.has(parkId)) {
      setCrowdData(headerCache.get(parkId) ?? null);
      return;
    }
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
        const result = data?.[0] ? {
          location: data[0].location_name,
          quietStart: data[0].quiet_start,
          quietEnd: data[0].quiet_end,
          peakStart: data[0].peak_start,
          peakEnd: data[0].peak_end,
          eveningQuiet: data[0].evening_quiet,
        } : null;
        headerCache.set(parkId, result);
        setCrowdData(result);
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
    if (nowMin < quietEnd) return { level: "Quiet", color: "text-status-quiet", dot: "bg-status-quiet" };
    if (nowMin < peakStart) return { level: "Moderate", color: "text-status-building", dot: "bg-status-building" };
    if (nowMin >= peakStart && nowMin < peakEnd) return { level: "Very Busy", color: "text-status-peak", dot: "bg-status-peak" };
    if (nowMin >= eveningQuiet) return { level: "Quiet", color: "text-status-quiet", dot: "bg-status-quiet" };
    return { level: "Busy", color: "text-status-busy", dot: "bg-status-busy" };
  }, [crowdData]);

  return (
    <div className="mx-5 mt-4 mb-2 rounded-xl border border-border/40 bg-card px-5 py-5" style={{ boxShadow: "var(--card-shadow)" }}>
      <h2 className="text-[18px] font-semibold text-foreground font-body leading-snug mb-2">{park.name}</h2>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${crowdStatus.dot}`} />
        <span className="text-[13px] font-normal font-body text-foreground/65">
          Crowds: <span className={`font-medium ${crowdStatus.color}`}>{crowdStatus.level}</span>
        </span>
      </div>
    </div>
  );
});

ParkStatusHeader.displayName = "ParkStatusHeader";

export default ParkStatusHeader;
