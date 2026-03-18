import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

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

const formatTime12 = (totalMins: number): string => {
  const h24 = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

// Timeline spans 6 AM – 9 PM
const DAY_START = 6 * 60;
const DAY_END = 21 * 60;
const DAY_SPAN = DAY_END - DAY_START;
const pct = (mins: number) => Math.max(0, Math.min(100, ((mins - DAY_START) / DAY_SPAN) * 100));

// Muted, desaturated palette for the day chart
const CHART_COLORS = {
  quiet: "#4A7C59",
  building: "#C8A84B",
  busy: "#C4703A",
  packed: "#B85450",
  base: "hsl(var(--muted) / 0.35)",
};

// Hour axis labels
const HOUR_TICKS = [6, 9, 12, 15, 18, 21].map((h) => ({
  mins: h * 60,
  label: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
}));

const DayChart = React.memo(({ forecast: f }: { forecast: Forecast }) => {
  const nowMin = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const nowPct = useMemo(() => {
    if (nowMin < DAY_START || nowMin > DAY_END) return null;
    return pct(nowMin);
  }, [nowMin]);

  const { segments, windowLabels } = useMemo(() => {
    const qs = timeToMinutes(f.quiet_start);
    const qe = timeToMinutes(f.quiet_end);
    const ps = timeToMinutes(f.peak_start);
    const pe = timeToMinutes(f.peak_end);
    const eq = timeToMinutes(f.evening_quiet);
    const buildSpan = ps - qe;
    const busyStart = qe + Math.round(buildSpan * 0.6);

    const rawSegs = [
      { startMin: Math.max(qs, DAY_START), endMin: qe, color: CHART_COLORS.quiet },
      { startMin: qe, endMin: busyStart, color: CHART_COLORS.building },
      { startMin: busyStart, endMin: ps, color: CHART_COLORS.busy },
      { startMin: ps, endMin: pe, color: CHART_COLORS.packed },
      { startMin: pe, endMin: eq, color: CHART_COLORS.busy },
      { startMin: eq, endMin: Math.min(DAY_END, 21 * 60), color: CHART_COLORS.quiet },
    ];
    const segs = rawSegs
      .filter((s) => s.endMin > s.startMin)
      .map((s) => ({
        flex: s.endMin - s.startMin,
        color: s.color,
        startPct: pct(s.startMin),
      }));

    const labels = [
      { dot: CHART_COLORS.quiet, label: "Best window", time: `${formatTime12(Math.max(qs, DAY_START))}–${formatTime12(qe)}` },
      { dot: CHART_COLORS.packed, label: "Peak hours", time: `${formatTime12(ps)}–${formatTime12(pe)}` },
      { dot: CHART_COLORS.quiet, label: "Quiet again", time: `After ${formatTime12(eq)}` },
    ];

    return { segments: segs, windowLabels: labels };
  }, [f.quiet_start, f.quiet_end, f.peak_start, f.peak_end, f.evening_quiet]);

  const NEEDLE_COLOR = "#2F6B4F";

  return (
    <div>
      {/* Location name */}
      <h3 className="font-semibold text-[13px] text-foreground/70 mb-2">{f.location_name}</h3>

      {/* Day chart with gauge-style NOW marker */}
      <div className="relative" style={{ paddingTop: nowPct !== null ? "28px" : "0" }}>
        {/* NOW gauge marker — above + through the bar */}
        {nowPct !== null && (
          <div className="absolute z-20" style={{ left: `${nowPct}%`, top: 0, bottom: 0 }}>
            {/* NOW label */}
            <span
              className="absolute left-1/2 -translate-x-1/2 font-black uppercase tracking-wider whitespace-nowrap"
              style={{ top: "0px", fontSize: "10px", color: NEEDLE_COLOR }}
            >
              NOW
            </span>
            {/* Circle anchor at top of bar */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "18px",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                border: `2px solid ${NEEDLE_COLOR}`,
                zIndex: 3,
              }}
            />
            {/* Vertical needle line from circle into bar */}
            <div
              className="absolute left-1/2 -translate-x-1/2 now-marker-pulse"
              style={{
                top: "24px",
                bottom: 0,
                width: "2px",
                backgroundColor: NEEDLE_COLOR,
                zIndex: 2,
              }}
            />
          </div>
        )}

        {/* The bar — 52px, continuous strip using flex for zero gaps */}
        <div className="relative overflow-hidden flex" style={{ height: "52px", borderRadius: "12px", backgroundColor: CHART_COLORS.base }}>
          {/* Left padding if first segment doesn't start at DAY_START */}
          {segments.length > 0 && segments[0].startPct > 0 && (
            <div style={{ flex: segments[0].startPct }} />
          )}
          {segments.map((s, i) => (
            <div
              key={i}
              className="h-full"
              style={{
                flex: s.flex,
                backgroundColor: s.color,
                minWidth: 0,
              }}
            />
          ))}
        </div>

        {/* Hour axis */}
        <div className="relative h-5 mt-1">
          {HOUR_TICKS.map((t) => (
            <span
              key={t.label}
              className="absolute text-[9px] font-semibold -translate-x-1/2"
              style={{ left: `${pct(t.mins)}%`, color: "#6B7280" }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Window summary labels — tight 8px gap to chart */}
      <div className="flex items-center gap-5 flex-wrap" style={{ marginTop: "8px" }}>
        {windowLabels.map((w) => (
          <div key={w.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.dot }} />
            <span className="text-[11px] font-semibold" style={{ color: "#6B7280" }}>{w.label}</span>
            <span className="text-[11px] font-medium" style={{ color: "#6B7280" }}>— {w.time}</span>
          </div>
        ))}
      </div>




      {f.notes && (
        <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed border-t border-border/60 pt-2.5">
          🐻 {f.notes}
        </p>
      )}
    </div>
  );
});
DayChart.displayName = "DayChart";

const ClosedCard = React.memo(({ f }: { f: Forecast }) => (
  <div className="content-card">
    <h3 className="font-semibold text-[14px] text-foreground mb-2">{f.location_name}</h3>
    <div className="flex items-center gap-2.5 rounded-md bg-muted/60 border border-border px-3 py-3">
      <AlertTriangle size={14} className="text-destructive shrink-0" />
      <div>
        <p className="text-[11px] font-semibold text-destructive">Closed for Season</p>
        {f.notes && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{f.notes}</p>}
      </div>
    </div>
  </div>
));
ClosedCard.displayName = "ClosedCard";

const forecastCache = new Map<string, Forecast[]>();

const CrowdWindows = ({ parkId, season = "summer", onHeadlineData }: CrowdWindowsProps) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dayType, setDayType] = useState<"weekday" | "weekend">(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  });
  const mountedRef = useRef(true);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (emblaApi && forecasts.length > 0) emblaApi.scrollTo(0, true);
  }, [emblaApi, forecasts]);

  useEffect(() => {
    const cacheKey = `${parkId}:${season}:${dayType}`;
    const cached = forecastCache.get(cacheKey);
    if (cached) {
      setForecasts(cached);
      setActiveIndex(0);
      setHasLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("park_crowd_forecasts")
        .select("id, location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, day_type, display_order")
        .eq("park_id", parkId).eq("season", season).eq("day_type", dayType)
        .order("display_order");
      if (!mountedRef.current) return;
      const results = (data ?? []) as Forecast[];
      forecastCache.set(cacheKey, results);
      setForecasts(results);
      setActiveIndex(0);
      setHasLoaded(true);
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


  if (!hasLoaded && forecasts.length === 0) {
    return (
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading crowd forecasts…</span>
        </div>
      </div>
    );
  }

  if (hasLoaded && forecasts.length === 0) return null;

  return (
    <div className="px-4 mb-5">

      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <span className="text-[22px] font-bold tracking-tight text-foreground">Today's Crowd Pattern</span>
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
          {(["weekday", "weekend"] as const).map((dt) => (
            <button
              key={dt}
              onClick={() => setDayType(dt)}
              className={`px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${
                dayType === dt ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dt === "weekday" ? "Weekday" : "Weekend"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground/60 mt-0.5 mb-4">Based on historical patterns</p>

      {/* Carousel of day charts */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {forecasts.map((f) => {
            const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;
            return (
              <div key={f.id} className="min-w-0 shrink-0 grow-0 basis-full">
                {isClosed ? <ClosedCard f={f} /> : <DayChart forecast={f} />}
              </div>
            );
          })}
        </div>
      </div>

      {forecasts.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {forecasts.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`rounded-full transition-all ${i === activeIndex ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
              aria-label={`View ${forecasts[i].location_name}`}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
        Green = quiet · Amber = building · Orange = busy · Red = packed
      </p>

    </div>
  );
};

export default React.memo(CrowdWindows);
