import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, X, Info } from "lucide-react";
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

  const { segments, windowLabels, interpretation } = useMemo(() => {
    const qs = timeToMinutes(f.quiet_start);
    const qe = timeToMinutes(f.quiet_end);
    const ps = timeToMinutes(f.peak_start);
    const pe = timeToMinutes(f.peak_end);
    const eq = timeToMinutes(f.evening_quiet);
    const buildSpan = ps - qe;
    const busyStart = qe + Math.round(buildSpan * 0.6);

    const segs = [
      { left: pct(Math.max(qs, DAY_START)), width: pct(qe) - pct(Math.max(qs, DAY_START)), color: CHART_COLORS.quiet },
      { left: pct(qe), width: pct(busyStart) - pct(qe), color: CHART_COLORS.building },
      { left: pct(busyStart), width: pct(ps) - pct(busyStart), color: CHART_COLORS.busy },
      { left: pct(ps), width: pct(pe) - pct(ps), color: CHART_COLORS.packed },
      { left: pct(pe), width: pct(eq) - pct(pe), color: CHART_COLORS.busy },
      { left: pct(eq), width: pct(Math.min(DAY_END, 21 * 60)) - pct(eq), color: CHART_COLORS.quiet },
    ].filter((s) => s.width > 0);

    const labels = [
      { dot: CHART_COLORS.quiet, label: "Best window", time: `${formatTime12(Math.max(qs, DAY_START))}–${formatTime12(qe)}` },
      { dot: CHART_COLORS.packed, label: "Peak hours", time: `${formatTime12(ps)}–${formatTime12(pe)}` },
      { dot: CHART_COLORS.quiet, label: "Quiet again", time: `After ${formatTime12(eq)}` },
    ];

    let interp: string | null = null;
    if (nowMin >= DAY_START && nowMin <= DAY_END) {
      if (nowMin >= eq) {
        interp = "Conditions are currently quiet. This is a great time to visit.";
      } else if (nowMin >= ps && nowMin < pe) {
        interp = `Crowds are currently at peak levels. Quieter conditions expected after ${formatTime12(eq)}.`;
      } else if (nowMin >= busyStart && nowMin < ps) {
        interp = `Crowds are heavy and still building. Peak expected around ${formatTime12(ps)}.`;
      } else if (nowMin >= qe && nowMin < busyStart) {
        interp = "Crowds are building toward midday peak. Early arrival recommended.";
      } else if (nowMin >= pe && nowMin < eq) {
        interp = `Crowds are easing. Quiet conditions expected after ${formatTime12(eq)}.`;
      } else {
        interp = "Conditions are currently quiet. This is a great time to visit.";
      }
    }

    return { segments: segs, windowLabels: labels, interpretation: interp };
  }, [f.quiet_start, f.quiet_end, f.peak_start, f.peak_end, f.evening_quiet, nowMin]);

  const NEEDLE_COLOR = "#2F6B4F";

  return (
    <div>
      {/* Location name */}
      <h3 className="font-bold text-[15px] text-foreground mb-3">{f.location_name}</h3>

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

        {/* The bar — 44px, continuous strip */}
        <div className="relative overflow-hidden" style={{ height: "52px", borderRadius: "12px", backgroundColor: CHART_COLORS.base }}>
          {segments.map((s, i) => {
            const isFirst = i === 0;
            const isLast = i === segments.length - 1;
            return (
              <div
                key={i}
                className="absolute top-0 h-full"
                style={{
                  left: `${s.left}%`,
                  width: `${Math.max(s.width, 0.3)}%`,
                  backgroundColor: s.color,
                  borderRadius:
                    isFirst && isLast
                      ? "4px"
                      : isFirst
                      ? "4px 0 0 4px"
                      : isLast
                      ? "0 4px 4px 0"
                      : "0",
                }}
              />
            );
          })}
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

      {/* Interpretation line */}
      {interpretation && (
        <p className="text-[13px] text-muted-foreground/60 mt-2.5 leading-snug font-body">{interpretation}</p>
      )}

      {/* Confidence line */}
      <p className="text-[11px] text-muted-foreground/40 mt-2 font-medium">Based on historical crowd data</p>

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

const TOOLTIP_KEY = "wildatlas_crowd_timeline_tooltip_dismissed";
const TOOLTIP_RESERVED_HEIGHT = 76;

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
        .select("id, location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, day_type")
        .eq("park_id", parkId).eq("season", season).eq("day_type", dayType)
        .order("location_name");
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

  const [showTooltip, setShowTooltip] = useState(
    () => !localStorage.getItem(TOOLTIP_KEY)
  );

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, "1");
  }, []);

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
      {/* Tooltip */}
      <div style={{ minHeight: showTooltip ? TOOLTIP_RESERVED_HEIGHT : 0 }} className="transition-[min-height] duration-200 ease-out overflow-hidden">
        {showTooltip && (
          <div className="mb-3 flex items-start gap-2.5 bg-primary/8 border border-primary/15 rounded-[18px] px-3.5 py-3 relative">
            <Info size={14} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-snug mb-1">
                Swipe to explore crowd windows
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span><span style={{ color: CHART_COLORS.quiet }} className="font-bold">Green</span> = quiet</span>
                <span><span style={{ color: CHART_COLORS.building }} className="font-bold">Amber</span> = building</span>
                <span><span style={{ color: CHART_COLORS.busy }} className="font-bold">Orange</span> = busy</span>
                <span><span style={{ color: CHART_COLORS.packed }} className="font-bold">Red</span> = packed</span>
              </div>
            </div>
            <button
              onClick={dismissTooltip}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss tip"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <span className="section-header !mb-0 !pb-0">Crowd Windows</span>
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
    </div>
  );
};

export default React.memo(CrowdWindows);
