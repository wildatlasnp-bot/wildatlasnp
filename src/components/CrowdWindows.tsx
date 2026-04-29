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

// Timeline spans 5 AM – 9 PM
const DAY_START = 5 * 60;
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

const ZONE_HEX = {
  quiet: "#2F6F4E",
  building: "#C9A96E",
  busy: "#E8935A",
  packed: "#C0392B",
};

// Hour axis labels
const HOUR_TICKS = [
  { mins: 5 * 60,  label: "5a" },
  { mins: 9 * 60,  label: "9a" },
  { mins: 12 * 60, label: "12p" },
  { mins: 15 * 60, label: "3p" },
  { mins: 18 * 60, label: "6p" },
  { mins: 21 * 60, label: "9p" },
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

  const NEEDLE_COLOR = "#1A2F1E";

  // ---- Build intensity curve from forecast key times ----
  // Maps the day's rhythm to control points (minutes -> intensity 0..100)
  const curveData = useMemo(() => {
    const qs = timeToMinutes(f.quiet_start);
    const qe = timeToMinutes(f.quiet_end);
    const ps = timeToMinutes(f.peak_start);
    const pe = timeToMinutes(f.peak_end);
    const eq = timeToMinutes(f.evening_quiet);
    const buildSpan = ps - qe;
    const busyStart = qe + Math.round(buildSpan * 0.6);

    // Anchor points: [minutes, intensity, level]
    const points: Array<{ m: number; v: number; level: keyof typeof ZONE_HEX }> = ([
      { m: DAY_START,                v: 8,   level: "quiet" as const },
      { m: Math.max(qs, DAY_START),  v: 12,  level: "quiet" as const },
      { m: qe,                       v: 35,  level: "building" as const },
      { m: busyStart,                v: 65,  level: "busy" as const },
      { m: ps,                       v: 95,  level: "packed" as const },
      { m: (ps + pe) / 2,            v: 100, level: "packed" as const },
      { m: pe,                       v: 70,  level: "busy" as const },
      { m: eq,                       v: 28,  level: "building" as const },
      { m: Math.min(eq + 90, DAY_END), v: 14, level: "quiet" as const },
      { m: DAY_END,                  v: 8,   level: "quiet" as const },
    ]).filter((p, i, arr) => i === 0 || p.m > arr[i - 1].m);

    return points;
  }, [f.quiet_start, f.quiet_end, f.peak_start, f.peak_end, f.evening_quiet]);

  // Chart geometry (viewBox uses 1000 x 200 for crisp math, scales to container)
  const VB_W = 1000;
  const VB_H = 200;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 4;
  const innerH = VB_H - PAD_TOP - PAD_BOTTOM;

  const xFor = (mins: number) => ((mins - DAY_START) / DAY_SPAN) * VB_W;
  const yFor = (v: number) => PAD_TOP + (1 - v / 100) * innerH;

  // Catmull-Rom -> cubic bezier for a smooth curve
  const buildPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 2) return "";
    const tension = 0.5;
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  };

  const pixelPts = curveData.map((p) => ({ x: xFor(p.m), y: yFor(p.v) }));
  const linePath = buildPath(pixelPts);
  const areaPath = `${linePath} L ${VB_W} ${VB_H - PAD_BOTTOM} L 0 ${VB_H - PAD_BOTTOM} Z`;

  // Stroke gradient stops mapped to the curve's level colors at each anchor's x
  const strokeStops = curveData.map((p) => ({
    offset: ((p.m - DAY_START) / DAY_SPAN) * 100,
    color: ZONE_HEX[p.level],
  }));

  // NOW intersection on the curve — find Y at nowMin using linear interp between anchors
  const nowOnCurve = useMemo(() => {
    if (nowPct === null) return null;
    const m = nowMin;
    for (let i = 0; i < curveData.length - 1; i++) {
      const a = curveData[i];
      const b = curveData[i + 1];
      if (m >= a.m && m <= b.m) {
        const t = (m - a.m) / (b.m - a.m || 1);
        const v = a.v + (b.v - a.v) * t;
        return { x: xFor(m), y: yFor(v), v };
      }
    }
    return null;
  }, [nowPct, nowMin, curveData]);

  const gradId = `crowd-area-fill-${f.id}`;
  const strokeId = `crowd-stroke-${f.id}`;
  const clipId = `crowd-clip-${f.id}`;

  return (
    <div>
      {/* Location name */}
      <h3 className="font-semibold text-[13px] text-foreground/70 mb-2">{f.location_name}</h3>

      {/* SVG area chart — sits directly on the outer surface, 24px horizontal pad applied by parent */}
      <div className="relative" style={{ width: "100%" }}>
        <svg
          key={animationKey}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 140, display: "block", overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            {/* Vertical fill — softer at quiet (bottom), warmer at peak (top) */}
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(192,57,43,0.18)" />
              <stop offset="55%"  stopColor="rgba(232,147,90,0.10)" />
              <stop offset="100%" stopColor="rgba(47,111,78,0.06)" />
            </linearGradient>

            {/* Horizontal stroke gradient — color follows crowd state along X */}
            <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
              {strokeStops.map((s, i) => (
                <stop key={i} offset={`${s.offset}%`} stopColor={s.color} />
              ))}
            </linearGradient>

            {/* Reveal clip — drives the left-to-right draw-in animation */}
            <clipPath id={clipId}>
              <rect x="0" y="0" width={VB_W} height={VB_H}>
                <animate attributeName="width" from="0" to={VB_W} dur="0.7s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </rect>
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} fill="none" stroke={`url(#${strokeId})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>

          {/* NOW marker — hairline + dot on the curve */}
          {nowOnCurve && (
            <g>
              <line
                x1={nowOnCurve.x}
                x2={nowOnCurve.x}
                y1={nowOnCurve.y}
                y2={VB_H - PAD_BOTTOM}
                stroke={NEEDLE_COLOR}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={nowOnCurve.x} cy={nowOnCurve.y} r={4} fill={NEEDLE_COLOR} />
            </g>
          )}
        </svg>

        {/* NOW label — positioned via percentage so it tracks the curve point */}
        {nowOnCurve && nowPct !== null && (
          <div
            className="absolute pointer-events-none uppercase whitespace-nowrap"
            style={{
              left: `${nowPct}%`,
              top: `calc(${(nowOnCurve.y / VB_H) * 100}% - 22px)`,
              transform: nowPct > 88 ? "translateX(-100%)" : nowPct < 6 ? "translateX(0)" : "translateX(-50%)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: "'DM Sans', sans-serif",
              color: NEEDLE_COLOR,
            }}
          >
            NOW
          </div>
        )}

        {/* Hour axis */}
        <div className="relative h-5 mt-1">
          {HOUR_TICKS.map((t) => (
            <span
              key={t.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${pct(t.mins)}%`, color: "#8A9E8A", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>


      {/* Window summary labels */}
      <div className="flex items-center gap-5 flex-wrap" style={{ marginTop: "8px" }}>
        {windowLabels.map((w, i) => (
          <div
            key={`${animationKey}-${w.label}`}
            className="flex items-center gap-1.5"
            style={{
              animation: `labelFadeUp 320ms cubic-bezier(0.4,0,0.2,1) ${500 + i * 80}ms both`,
            }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.dot }} />
            <span className="text-[12px] font-semibold" style={{ color: "var(--wa-ink-gray)" }}>{w.label}</span>
            <span className="text-[12px] font-medium" style={{ color: "var(--wa-ink-gray)" }}>— {w.time}</span>
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
        <p className="text-[12px] font-semibold text-destructive">Closed for Season</p>
        {f.notes && <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{f.notes}</p>}
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
    const onSelect = () => { setActiveIndex(emblaApi.selectedScrollSnap()); setAnimKey(k => k + 1); };
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
              onClick={() => { setDayType(dt); setAnimKey(k => k + 1); }}
              className={`relative flex items-center justify-center px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all duration-200 ${
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
                {isClosed ? <ClosedCard f={f} /> : <DayChart forecast={f} animationKey={animKey} />}
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
};

export default React.memo(CrowdWindows);
