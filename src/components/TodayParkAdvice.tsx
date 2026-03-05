import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sunrise, Clock, CarFront, Moon } from "lucide-react";
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

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const quietEndMin = toMinutes(forecast.quiet_end);
  const parkingFills = addMinutes(forecast.quiet_end, 30);
  const isPast = nowMin >= quietEndMin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-status-quiet/25 bg-status-quiet/8 p-5 shadow-[0_4px_24px_-6px_hsl(var(--status-quiet)/0.18)]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-status-quiet/15 flex items-center justify-center">
          <Sunrise size={15} className="text-status-quiet" />
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-status-quiet">
          Today's Park Advice
        </span>
      </div>

      {/* Primary recommendation */}
      {isPast ? (
        <h2 className="font-heading font-black text-[34px] leading-[1.05] tracking-tight text-foreground">
          Next quiet window{" "}
          <span className="text-status-quiet">after {forecast.evening_quiet}</span>
        </h2>
      ) : (
        <h2 className="font-heading font-black text-[34px] leading-[1.05] tracking-tight text-foreground">
          Arrive before{" "}
          <span className="text-status-quiet">{forecast.quiet_end}</span>
        </h2>
      )}

      {/* Divider */}
      <div className="border-t border-status-quiet/15 mt-4 mb-3.5" />

      {/* Supporting details */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <Clock size={14} className="text-status-quiet shrink-0" />
          <p className="text-[13px] text-foreground/90 font-medium leading-snug">
            Best window: <span className="font-bold">{forecast.quiet_start} – {forecast.quiet_end}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CarFront size={14} className="text-status-building shrink-0" />
          <p className="text-[13px] text-foreground/90 font-medium leading-snug">
            Parking fills around: <span className="font-bold">{parkingFills}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Moon size={14} className="text-status-quiet/70 shrink-0" />
          <p className="text-[13px] text-foreground/90 font-medium leading-snug">
            Next quiet window: <span className="font-bold">After {forecast.evening_quiet}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default TodayParkAdvice;
