import { useState, useEffect, useMemo } from "react";
import { Activity, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";

interface ParkStatusHeaderProps {
  parkId: string;
}

type CrowdStatus = "LOW" | "MODERATE" | "HIGH" | "—";

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
  } | null>(null);
  const [scannerTime, setScannerTime] = useState<string | null>(null);
  const [lastFindAgo, setLastFindAgo] = useState<string | null>(null);
  const [scannerStale, setScannerStale] = useState(false);

  const park = PARKS[parkId] ?? PARKS.yosemite;

  // Fetch crowd forecast (first location)
  useEffect(() => {
    const now = new Date();
    const dayType = now.getDay() === 0 || now.getDay() === 6 ? "weekend" : "weekday";
    const month = now.getMonth();
    const season = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "fall" : "winter";

    supabase
      .from("park_crowd_forecasts")
      .select("location_name, quiet_start, quiet_end, peak_start")
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
          });
        } else {
          setCrowdData(null);
        }
      });
  }, [parkId]);

  // Fetch scanner heartbeat
  useEffect(() => {
    supabase
      .from("permit_cache")
      .select("fetched_at")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.fetched_at) {
          const diff = Math.floor((Date.now() - new Date(data.fetched_at).getTime()) / 60000);
          setScannerTime(diff < 1 ? "Just now" : diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`);
          setScannerStale(diff >= 10);
        }
      });
  }, [parkId]);

  // Fetch last permit find
  useEffect(() => {
    supabase
      .from("recent_finds")
      .select("found_at")
      .eq("park_id", parkId)
      .order("found_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.found_at) {
          const diff = Math.floor((Date.now() - new Date(data[0].found_at).getTime()) / 86400000);
          setLastFindAgo(diff === 0 ? "Today" : diff === 1 ? "1 day ago" : `${diff} days ago`);
        } else {
          setLastFindAgo(null);
        }
      });
  }, [parkId]);

  const crowdStatus: { level: CrowdStatus; color: string; dot: string } = useMemo(() => {
    if (!crowdData) return { level: "—", color: "text-muted-foreground", dot: "bg-muted-foreground" };
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const quietEnd = toMinutes(crowdData.quietEnd);
    const peakStart = toMinutes(crowdData.peakStart);
    if (nowMin < quietEnd) return { level: "LOW", color: "text-status-quiet", dot: "bg-status-quiet" };
    if (nowMin < peakStart) return { level: "MODERATE", color: "text-status-building", dot: "bg-status-building" };
    return { level: "HIGH", color: "text-status-peak", dot: "bg-status-peak" };
  }, [crowdData]);

  const bestWindow = crowdData ? `${crowdData.quietStart} – ${crowdData.quietEnd}` : "—";
  const scannerLabel = scannerTime ? `Running · ${scannerTime}` : "Running";

  return (
    <div className="mx-5 mt-3 mb-1 rounded-xl border border-border bg-card px-4 py-3" style={{ boxShadow: "var(--card-shadow)" }}>
      {/* Park name */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[16px] font-bold text-foreground font-body tracking-tight">{park.name}</h2>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Crowds */}
        <div className="flex items-center gap-1.5">
          <span className={`w-[6px] h-[6px] rounded-full ${crowdStatus.dot}${crowdStatus.level === "HIGH" ? " animate-pulse" : ""}`} />
          <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">Crowds</span>
          <span className={`text-[12px] font-bold ${crowdStatus.color}`}>{crowdStatus.level}</span>
        </div>

        {/* Divider */}
        <span className="w-px h-3 bg-border" />

        {/* Best window */}
        <div className="flex items-center gap-1.5">
          <Clock size={9} className="text-muted-foreground/70" />
          <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">Best</span>
          <span className="text-[12px] font-bold text-foreground">{bestWindow}</span>
        </div>

        {/* Divider */}
        <span className="w-px h-3 bg-border" />

        {/* Scanner */}
        <div className="flex items-center gap-1.5">
          <Activity size={9} className={`${scannerStale ? "text-status-peak animate-pulse" : "text-status-scanning"}`} />
          <span className="text-[11px] font-medium text-muted-foreground">{scannerLabel}</span>
        </div>

        {/* Last find */}
        {lastFindAgo && (
          <>
            <span className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Zap size={9} className="text-status-found" />
              <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">Last find</span>
              <span className="text-[11px] font-medium text-foreground">{lastFindAgo}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParkStatusHeader;
