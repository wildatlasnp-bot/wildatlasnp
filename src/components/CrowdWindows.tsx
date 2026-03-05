import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sun, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

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
  onHeadlineData?: (data: { location: string; quietStart: string; quietEnd: string; buildingTime: string; peakStart: string; eveningQuiet: string } | null) => void;
}

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
const pct = (mins: number) => Math.max(0, Math.min(100, ((mins - DAY_START) / DAY_SPAN) * 100));

const TimelineBar = ({ forecast: f }: { forecast: Forecast }) => {
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
    <div className="mt-1 mb-1">
      <div className="relative h-3.5 rounded-full bg-muted/50 overflow-hidden">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`absolute top-0 h-full ${s.color} first:rounded-l-full last:rounded-r-full`}
            style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.5)}%` }}
          />
        ))}
      </div>
      <div className="relative h-3.5 mt-0.5">
        {ticks.map((t) => (
          <span key={t.label} className="absolute text-[9px] text-muted-foreground font-medium -translate-x-1/2" style={{ left: `${t.pctVal}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const ForecastCard = ({ f }: { f: Forecast }) => {
  const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;

  if (isClosed) {
    return (
      <div className="content-card">
        <h3 className="font-semibold text-[13px] text-foreground mb-2">{f.location_name}</h3>
        <div className="flex items-center gap-2.5 rounded-md bg-muted/60 border border-border px-3 py-3">
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-destructive">Closed for Season</p>
            {f.notes && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{f.notes}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-[13px] text-foreground mb-2">{f.location_name}</h3>

      {/* ── Primary insight: Best Time — no card wrapper ── */}
      <div className="flex items-baseline gap-2 mb-3">
        <Sun size={14} className="text-status-quiet shrink-0 relative top-[1px]" />
        <div>
          <p className="text-[9px] font-bold text-status-quiet uppercase tracking-[0.1em]">Best Time</p>
          <p className="text-[17px] font-bold text-foreground font-body leading-tight tracking-tight">{f.quiet_start} – {f.quiet_end}</p>
        </div>
      </div>

      {/* ── Timeline bar ── */}
      <TimelineBar forecast={f} />

      {/* ── Two secondary time ranges — flat layout ── */}
      <div className="flex gap-6 mt-3">
        <div>
          <p className="text-[9px] font-bold text-status-peak uppercase tracking-[0.1em]">Avoid</p>
          <p className="text-[13px] font-semibold text-foreground tracking-tight">{f.peak_start} – {f.peak_end}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-status-quiet uppercase tracking-[0.1em]">Quiet Again</p>
          <p className="text-[13px] font-semibold text-foreground tracking-tight">After {f.evening_quiet}</p>
        </div>
      </div>

      {f.notes && (
        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed border-t border-border pt-2.5">
          🐻 {f.notes}
        </p>
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

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("park_crowd_forecasts")
        .select("id, location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, day_type")
        .eq("park_id", parkId).eq("season", season).eq("day_type", dayType)
        .order("location_name");
      if (!mountedRef.current) return;
      setForecasts((data ?? []) as Forecast[]);
      setActiveIndex(0);
      setLoading(false);
    };
    load();
  }, [parkId, dayType, season]);

  useEffect(() => {
    if (!onHeadlineData) return;
    if (forecasts.length === 0) { onHeadlineData(null); return; }
    const f = forecasts[0];
    const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;
    onHeadlineData(isClosed ? null : {
      location: f.location_name,
      quietStart: f.quiet_start,
      quietEnd: f.quiet_end,
      buildingTime: f.building_time,
      peakStart: f.peak_start,
      eveningQuiet: f.evening_quiet,
    });
  }, [forecasts, onHeadlineData]);

  const goNext = useCallback(() => setActiveIndex((i) => (i + 1) % forecasts.length), [forecasts.length]);
  const goPrev = useCallback(() => setActiveIndex((i) => (i - 1 + forecasts.length) % forecasts.length), [forecasts.length]);

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

  return (
    <div className="px-5 mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Crowd Windows</span>
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {(["weekday", "weekend"] as const).map((dt) => (
            <button
              key={dt}
              onClick={() => setDayType(dt)}
              className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all ${
                dayType === dt ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dt === "weekday" ? "Weekday" : "Weekend"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${parkId}-${dayType}-${season}-${activeIndex}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
        >
          <ForecastCard f={forecasts[activeIndex]} />
        </motion.div>
      </AnimatePresence>

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
                className={`rounded-full transition-all ${i === activeIndex ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
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
