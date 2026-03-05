import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sun, TrendingUp, Clock, Moon, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface Forecast {
  id: string;
  location_name: string;
  quiet_start: string;
  quiet_end: string;
  building_time: string;
  peak_start: string;
  peak_end: string;
  evening_quiet: string;
  notes: string | null;
  day_type: string;
}

interface CrowdWindowsProps {
  parkId: string;
  season?: string;
  /** If true, only show the primary insight headline (used by parent) */
  headlineOnly?: boolean;
  onHeadlineData?: (data: { location: string; quietStart: string; quietEnd: string } | null) => void;
}

/** Convert "6:30 AM" → minutes from midnight */
const timeToMinutes = (t: string): number => {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return h * 60 + m;
};

const DAY_START = 5 * 60;
const DAY_END = 22 * 60;
const DAY_SPAN = DAY_END - DAY_START;

const pct = (mins: number) =>
  Math.max(0, Math.min(100, ((mins - DAY_START) / DAY_SPAN) * 100));

interface TimelineBarProps {
  forecast: Forecast;
}

const TimelineBar = ({ forecast: f }: TimelineBarProps) => {
  const segments = useMemo(() => {
    const qs = timeToMinutes(f.quiet_start);
    const qe = timeToMinutes(f.quiet_end);
    const bt = timeToMinutes(f.building_time);
    const ps = timeToMinutes(f.peak_start);
    const pe = timeToMinutes(f.peak_end);
    const eq = timeToMinutes(f.evening_quiet);

    return [
      { left: pct(qs), width: pct(qe) - pct(qs), color: "bg-status-quiet", label: "Quiet" },
      { left: pct(bt), width: pct(ps) - pct(bt), color: "bg-status-building", label: "Building" },
      { left: pct(ps), width: pct(pe) - pct(ps), color: "bg-status-peak", label: "Peak" },
      { left: pct(eq), width: 100 - pct(eq), color: "bg-status-quiet/60", label: "Evening" },
    ];
  }, [f]);

  const ticks = useMemo(() => {
    const result: { pctVal: number; label: string }[] = [];
    for (let h = 6; h <= 21; h += 3) {
      const label = h <= 12 ? `${h === 12 ? 12 : h}${h < 12 ? "a" : "p"}` : `${h - 12}p`;
      result.push({ pctVal: pct(h * 60), label });
    }
    return result;
  }, []);

  return (
    <div className="mt-0.5 mb-1">
      <div className="relative h-2.5 rounded-full bg-muted/40 overflow-hidden">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`absolute top-0 h-full ${s.color} opacity-70 first:rounded-l-full last:rounded-r-full`}
            style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.5)}%` }}
          />
        ))}
      </div>
      <div className="relative h-3 mt-0.5">
        {ticks.map((t) => (
          <span
            key={t.label}
            className="absolute text-[8px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${t.pctVal}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const ForecastCard = ({ f }: { f: Forecast }) => {
  const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;

  return (
    <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--card-shadow)" }}>
      <h3 className="font-semibold text-[13px] text-foreground mb-2.5">{f.location_name}</h3>

      {isClosed ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/60 border border-border px-3 py-3">
          <div className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle size={14} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-destructive">Closed for Season</p>
            {f.notes && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{f.notes}</p>}
          </div>
        </div>
      ) : (
        <>
          <TimelineBar forecast={f} />

          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex items-start gap-2 rounded-lg bg-status-quiet/8 border border-status-quiet/15 px-2.5 py-2">
              <Sun size={12} className="text-status-quiet mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-status-quiet-foreground uppercase tracking-wider">Quiet</p>
                <p className="text-[11px] text-foreground font-medium">{f.quiet_start} – {f.quiet_end}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-status-building/8 border border-status-building/15 px-2.5 py-2">
              <TrendingUp size={12} className="text-status-building mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-status-building-foreground uppercase tracking-wider">Building</p>
                <p className="text-[11px] text-foreground font-medium">From {f.building_time}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-status-peak/8 border border-status-peak/15 px-2.5 py-2">
              <Clock size={12} className="text-status-peak mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-status-peak-foreground uppercase tracking-wider">Peak</p>
                <p className="text-[11px] text-foreground font-medium">{f.peak_start} – {f.peak_end}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-status-quiet/5 border border-status-quiet/10 px-2.5 py-2">
              <Moon size={12} className="text-status-quiet mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-status-quiet-foreground uppercase tracking-wider">Quiet Again</p>
                <p className="text-[11px] text-foreground font-medium">After {f.evening_quiet}</p>
              </div>
            </div>
          </div>

          {f.notes && (
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed flex items-start gap-1.5">
              <span>🐻</span>
              <span>{f.notes}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
};

const CrowdWindows = ({ parkId, season = "summer", onHeadlineData }: CrowdWindowsProps) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dayType, setDayType] = useState<"weekday" | "weekend">(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("park_crowd_forecasts")
        .select("id, location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, day_type")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("location_name");

      if (!mountedRef.current) return;
      const results = (data ?? []) as Forecast[];
      setForecasts(results);
      setActiveIndex(0);
      setLoading(false);
    };
    fetch();
  }, [parkId, dayType, season]);

  // Send headline data to parent for "Today's Park Plan"
  useEffect(() => {
    if (!onHeadlineData) return;
    if (forecasts.length === 0) {
      onHeadlineData(null);
      return;
    }
    const f = forecasts[0];
    const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;
    if (isClosed) {
      onHeadlineData(null);
    } else {
      onHeadlineData({ location: f.location_name, quietStart: f.quiet_start, quietEnd: f.quiet_end });
    }
  }, [forecasts, onHeadlineData]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % forecasts.length);
  }, [forecasts.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + forecasts.length) % forecasts.length);
  }, [forecasts.length]);

  if (loading) {
    return (
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading crowd forecasts…</span>
        </div>
      </div>
    );
  }

  if (forecasts.length === 0) return null;

  const activeForecast = forecasts[activeIndex];

  return (
    <div className="px-5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
            Crowd Windows
          </span>
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setDayType("weekday")}
            className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all ${
              dayType === "weekday"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Weekday
          </button>
          <button
            onClick={() => setDayType("weekend")}
            className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all ${
              dayType === "weekend"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Weekend
          </button>
        </div>
      </div>

      {/* Single card carousel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${parkId}-${dayType}-${season}-${activeIndex}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
        >
          <ForecastCard f={activeForecast} />
        </motion.div>
      </AnimatePresence>

      {/* Pagination dots + arrows */}
      {forecasts.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={goPrev} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Previous location">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {forecasts.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`rounded-full transition-all ${
                  i === activeIndex
                    ? "w-4 h-1.5 bg-primary"
                    : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`View ${forecasts[i].location_name}`}
              />
            ))}
          </div>
          <button onClick={goNext} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Next location">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CrowdWindows;
