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
  children?: React.ReactNode;
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
  quiet: "var(--wa-crowd-quiet)",
  building: "var(--wa-crowd-building)",
  busy: "var(--wa-crowd-busy)",
  packed: "var(--wa-crowd-packed)",
  base: "hsl(var(--muted) / 0.35)",
};

// Bar height per crowd level — keyed by level name, aligns to bottom baseline
const CROWD_HEIGHTS: Record<string, number> = {
  quiet:    36,
  building: 44,
  busy:     48,
  packed:   52,
};

// Hour axis labels
const HOUR_TICKS = [
  { mins: 6 * 60, label: "a" },
  { mins: 9 * 60, label: "9a" },
  { mins: 12 * 60, label: "12p" },
  { mins: 15 * 60, label: "3p" },
  { mins: 18 * 60, label: "6p" },
  { mins: 21 * 60, label: "8" },
];

const DayChart = React.memo(({ forecast: f, animationKey = 0 }: { forecast: Forecast; animationKey?: number }) => {
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
      { startMin: Math.max(qs, DAY_START), endMin: qe, color: CHART_COLORS.quiet,    level: "quiet" },
      { startMin: qe, endMin: busyStart,  color: CHART_COLORS.building, level: "building" },
      { startMin: busyStart, endMin: ps,  color: CHART_COLORS.busy,     level: "busy" },
      { startMin: ps, endMin: pe,         color: CHART_COLORS.packed,   level: "packed" },
      { startMin: pe, endMin: eq,         color: CHART_COLORS.busy,     level: "busy" },
      { startMin: eq, endMin: Math.min(DAY_END, 21 * 60), color: CHART_COLORS.quiet, level: "quiet" },
    ];
    const segs = rawSegs
      .filter((s) => s.endMin > s.startMin)
      .map((s) => ({
        flex: s.endMin - s.startMin,
        color: s.color,
        level: s.level,
        startPct: pct(s.startMin),
      }));

    const labels = [
      { dot: CHART_COLORS.quiet, label: "Best window", time: `${formatTime12(Math.max(qs, DAY_START))}–${formatTime12(qe)}` },
      { dot: CHART_COLORS.packed, label: "Peak hours", time: `${formatTime12(ps)}–${formatTime12(pe)}` },
      { dot: CHART_COLORS.quiet, label: "Quiet again", time: `After ${formatTime12(eq)}` },
    ];

    return { segments: segs, windowLabels: labels };
  }, [f.quiet_start, f.quiet_end, f.peak_start, f.peak_end, f.evening_quiet]);

  const NEEDLE_COLOR = "var(--wa-crowd-needle)";

  return (
    <div>
      {/* Location name */}
      <h3 className="font-semibold text-[13px] text-foreground/70 mb-2">{f.location_name}</h3>

      {/* Day chart with gauge-style NOW marker */}
      <div className="relative" style={{ paddingTop: nowPct !== null ? "28px" : "0", paddingLeft: 8, paddingRight: 8, overflow: 'visible' }}>
        {/* NOW gauge marker — above + through the bar */}
        {nowPct !== null && (
          <div className="absolute z-20" style={{ left: `${nowPct}%`, top: 0, bottom: 0, overflow: 'visible' }}>
            {/* NOW label */}
            <span
              className="absolute uppercase whitespace-nowrap"
              style={{
                top: "0px",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: NEEDLE_COLOR,
                overflow: 'visible',
                ...(nowPct > 80
                  ? { right: '50%', transform: 'translateX(4px)' }
                  : { left: '50%', transform: 'translateX(-50%)' }
                ),
              }}
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
        <div key={animationKey} className="relative flex" style={{ height: "52px", borderRadius: "12px", backgroundColor: CHART_COLORS.base, alignItems: "flex-end", overflow: 'visible' }}>
          {/* Left padding if first segment doesn't start at DAY_START */}
          {segments.length > 0 && segments[0].startPct > 0 && (
            <div style={{ flex: segments[0].startPct }} />
          )}
          {segments.map((s, i) => (
            <div
              key={i}
              className="crowd-segment"
              style={{
                '--bar-target': s.flex,
                flex: s.flex,
                backgroundColor: s.color,
                minWidth: 0,
                height: CROWD_HEIGHTS[s.level] ?? 52,
                animation: `barGrow 300ms cubic-bezier(0.4,0,0.2,1) ${i * 60}ms both`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Hour axis */}
        <div className="relative h-5 mt-1">
          {HOUR_TICKS.map((t) => (
            <span
              key={t.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${pct(t.mins)}%`, color: "var(--wa-ink-gray)", fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", overflow: 'visible', whiteSpace: 'nowrap' }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Color legend — immediately below hour axis, before window labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 12, marginBottom: 12 }}>
        {[
          { color: CHART_COLORS.quiet, label: "Quiet" },
          { color: CHART_COLORS.building, label: "Building" },
          { color: CHART_COLORS.busy, label: "Busy" },
          { color: CHART_COLORS.packed, label: "Packed" },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: item.color }} />
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Window summary labels — tight 8px gap to chart */}
      <div className="flex items-center gap-5 flex-wrap" style={{ marginTop: "8px" }}>
        {windowLabels.map((w) => (
          <div key={w.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.dot }} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--wa-ink-gray)" }}>{w.label}</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--wa-ink-gray)" }}>— {w.time}</span>
          </div>
        ))}
      </div>

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

const CrowdWindows = ({ parkId, season = "summer", children, onHeadlineData }: CrowdWindowsProps) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
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
      <div className="px-4 mb-5">
        <div className="space-y-3 pt-1">
          {/* Bar placeholder */}
          <div className="h-[52px] bg-muted animate-pulse rounded-xl w-full" />
          {/* Axis placeholder */}
          <div className="h-2.5 bg-muted/50 animate-pulse rounded w-full" />
          {/* Legend placeholder */}
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-2.5 bg-muted/50 animate-pulse rounded w-12" />
            ))}
          </div>
          {/* Window label placeholders */}
          <div className="space-y-2.5 mt-1">
            <div className="h-3 bg-muted/40 animate-pulse rounded w-2/3" />
            <div className="h-3 bg-muted/40 animate-pulse rounded w-1/2" />
            <div className="h-3 bg-muted/40 animate-pulse rounded w-3/5" />
          </div>
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
          <span className="text-[15px] font-semibold tracking-tight text-foreground/80 leading-tight" style={{ fontSize: "15px" }}>Crowd Pattern</span>
        </div>
        <div className="flex items-center gap-1 rounded-[10px] bg-muted p-1">
          {(["weekday", "weekend"] as const).map((dt) => (
            <button
              key={dt}
              onClick={() => setDayType(dt)}
              className={`relative flex items-center justify-center px-3 py-1.5 rounded-[6px] text-[11px] font-semibold transition-all duration-200 ${
                dayType === dt
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dayType === dt && (
                <div className="absolute inset-0 bg-primary rounded-md shadow-sm" />
              )}
              <span className="relative">
                {dt === "weekday" ? "Weekday" : "Weekend"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground/60 mt-0.5 mb-4">Based on historical patterns</p>

      {children}

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


    </div>
  );
};

export default React.memo(CrowdWindows);
