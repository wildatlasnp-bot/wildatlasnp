import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CarFront } from "lucide-react";
import { getCurrentSeason } from "@/lib/park-seasons";

interface Forecast {
  location_name: string;
  quiet_start: string;
  quiet_end: string;
  building_time: string;
  peak_start: string;
  peak_end: string;
  evening_quiet: string;
}

function toMinutes(t: string): number {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return h * 60 + m;
}

function addMinutes(time: string, delta: number): string {
  const total = toMinutes(time) + delta;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const CARD_MIN_HEIGHT = 148;

const adviceCache = new Map<string, Forecast | null>();

const TodayParkAdvice = React.memo(({ parkId }: { parkId: string }) => {
  const cacheKey = parkId;
  const [forecast, setForecast] = useState<Forecast | null>(() => adviceCache.get(cacheKey) ?? null);
  const [hasLoaded, setHasLoaded] = useState(() => adviceCache.has(cacheKey));

  const season = getCurrentSeason();
  const dayType = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  }, []);

  useEffect(() => {
    if (adviceCache.has(cacheKey)) {
      setForecast(adviceCache.get(cacheKey) ?? null);
      setHasLoaded(true);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("park_crowd_forecasts")
        .select("location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("location_name")
        .limit(1);
      const result = data?.[0] ?? null;
      adviceCache.set(cacheKey, result);
      setForecast(result);
      setHasLoaded(true);
    };
    load();
  }, [parkId, season, dayType, cacheKey]);

  const isClosed = forecast && forecast.peak_start === forecast.peak_end && forecast.building_time === forecast.peak_start;

  if (!hasLoaded) {
    return <div style={{ minHeight: CARD_MIN_HEIGHT }} />;
  }

  if (!forecast || isClosed) return null;

  const parkingFills = addMinutes(forecast.quiet_end, 30);

  return (
    <div
      className="rounded-2xl border border-status-quiet/10 bg-status-quiet/[0.04]"
      style={{ padding: "12px 16px", boxShadow: "0 2px 16px -4px hsl(var(--status-quiet) / 0.08)" }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <CarFront size={13} className="text-status-building/70 shrink-0" />
          <p className="text-[13px] text-muted-foreground font-medium leading-snug font-body">
            Parking fills around <span className="font-bold text-foreground/80">{parkingFills}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Clock size={13} className="text-status-quiet/70 shrink-0" />
          <p className="text-[13px] text-muted-foreground font-medium leading-snug font-body">
            Next quiet window after <span className="font-bold text-foreground/80">{forecast.evening_quiet}</span>
          </p>
        </div>
      </div>
    </div>
  );
});

TodayParkAdvice.displayName = "TodayParkAdvice";

export default TodayParkAdvice;
