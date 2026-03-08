import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sunrise, Clock, CarFront } from "lucide-react";
import { motion } from "framer-motion";
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

const TodayParkAdvice = ({ parkId }: { parkId: string }) => {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  const season = getCurrentSeason();
  const dayType = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("park_crowd_forecasts")
        .select("location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("location_name")
        .limit(1);
      setForecast(data?.[0] ?? null);
      setLoading(false);
    };
    load();
  }, [parkId, season, dayType]);

  if (loading || !forecast) return null;

  const isClosed = forecast.peak_start === forecast.peak_end && forecast.building_time === forecast.peak_start;
  if (isClosed) return null;

  const parkingFills = addMinutes(forecast.quiet_end, 30);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-status-quiet/20 bg-status-quiet/6 px-6 py-7"
      style={{ boxShadow: "0 4px 24px -6px hsl(var(--status-quiet) / 0.12), var(--card-shadow)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 rounded-md bg-status-quiet/15 flex items-center justify-center">
          <Sunrise size={13} className="text-status-quiet" />
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-status-quiet/80">
          Today's Park Advice
        </span>
      </div>

      {/* Primary headline */}
      <h2 className="type-display text-foreground">
        Arrive before{" "}
        <span className="text-status-quiet">{forecast.quiet_end}</span>
      </h2>

      {/* Supporting details */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2.5">
          <CarFront size={13} className="text-status-building/70 shrink-0" />
          <p className="type-meta font-medium leading-snug">
            Parking fills around <span className="font-bold text-foreground/80">{parkingFills}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Clock size={13} className="text-status-quiet/70 shrink-0" />
          <p className="text-[13px] text-muted-foreground font-medium leading-snug">
            Next quiet window after <span className="font-bold text-foreground/80">{forecast.evening_quiet}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default TodayParkAdvice;