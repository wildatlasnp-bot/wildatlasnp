import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Sun, AlertTriangle, X, Info } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";

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
  const nowPct = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < DAY_START || nowMin > DAY_END) return null;
    return pct(nowMin);
  }, []);

  const segments = useMemo(() => {
    const qs = timeToMinutes(f.quiet_start);
    const qe = timeToMinutes(f.quiet_end);
    const ps = timeToMinutes(f.peak_start);
    const pe = timeToMinutes(f.peak_end);
    const eq = timeToMinutes(f.evening_quiet);
    const buildSpan = ps - qe;
    const busyStart = qe + Math.round(buildSpan * 0.6);

    return [
      { left: pct(qs), width: pct(qe) - pct(qs), color: "bg-status-quiet", label: "BEST TIME" as string | null, full: true },
      { left: pct(qe), width: pct(busyStart) - pct(qe), color: "bg-status-building", label: null, full: false },
      { left: pct(busyStart), width: pct(ps) - pct(busyStart), color: "bg-status-busy", label: "BUSY" as string | null, full: false },
      { left: pct(ps), width: pct(pe) - pct(ps), color: "bg-status-peak", label: "AVOID" as string | null, full: false },
      { left: pct(eq), width: 100 - pct(eq), color: "bg-status-quiet/60", label: null, full: false },
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

  const labelColors: Record<string, string> = {
    "BEST TIME": "text-status-quiet",
    "BUSY": "text-status-busy",
    "AVOID": "text-status-peak",
  };

  return (
    <div className="mt-1 mb-1">
      {/* Segment labels above bar */}
      <div className="relative h-4 mb-0.5">
        {segments.filter(s => s.label).map((s, i) => (
          <span
            key={i}
            className={`absolute text-[8px] font-extrabold uppercase tracking-[0.12em] ${labelColors[s.label!] ?? "text-muted-foreground"}`}
            style={{ left: `${s.left + s.width / 2}%`, transform: "translateX(-50%)" }}
          >
            {s.label}
          </span>
        ))}
      </div>

      {/* Bar */}
      <div className="relative h-7 rounded-full bg-muted/40 overflow-hidden shadow-inner">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`absolute top-0 h-full ${s.color} ${i === 0 ? "rounded-l-full" : ""} ${i === segments.length - 1 ? "rounded-r-full" : ""}`}
            style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.5)}%`, opacity: s.full ? 1 : 0.85 }}
          />
        ))}
        {nowPct !== null && (
          <div className="absolute top-0 h-full w-[2px] bg-foreground z-10" style={{ left: `${nowPct}%` }}>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground" />
          </div>
        )}
      </div>

      {/* Time ticks */}
      <div className="relative h-3.5 mt-1">
        {ticks.map((t) => (
          <span key={t.label} className="absolute text-[9px] text-muted-foreground/75 font-semibold -translate-x-1/2" style={{ left: `${t.pctVal}%` }}>
            {t.label}
          </span>
        ))}
      </div>

      {/* Text summary */}
      <p className="text-[11px] text-muted-foreground mt-1.5 font-body leading-snug">
        <span className="font-semibold text-status-quiet">Best arrival: {f.quiet_start}–{f.quiet_end}.</span>
        {" "}Crowds peak late morning.
      </p>
    </div>
  );
};

const ForecastCard = ({ f }: { f: Forecast }) => {
  const isClosed = f.peak_start === f.peak_end && f.building_time === f.peak_start;

  if (isClosed) {
    return (
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
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-[14px] text-foreground mb-2">{f.location_name}</h3>

      {/* ── Primary insight: Best Time — no card wrapper ── */}
      <div className="flex items-baseline gap-2 mb-3">
        <Sun size={14} className="text-status-quiet shrink-0 relative top-[1px]" />
        <div>
          <p className="text-[10px] font-bold text-status-quiet uppercase tracking-[0.1em]">Best Time</p>
          <p className="text-[18px] font-bold text-foreground font-body leading-tight tracking-tight">{f.quiet_start} – {f.quiet_end}</p>
        </div>
      </div>

      {/* ── Timeline bar ── */}
      <TimelineBar forecast={f} />

      {/* ── Two secondary time ranges — flat layout ── */}
      <div className="flex gap-6 mt-3">
        <div>
          <p className="text-[10px] font-bold text-status-peak uppercase tracking-[0.1em]">Avoid</p>
          <p className="text-[14px] font-semibold text-foreground tracking-tight">{f.peak_start} – {f.peak_end}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-status-quiet uppercase tracking-[0.1em]">Quiet Again</p>
          <p className="text-[14px] font-semibold text-foreground tracking-tight">After {f.evening_quiet}</p>
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

const TOOLTIP_KEY = "wildatlas_crowd_timeline_tooltip_dismissed";

const CrowdWindows = ({ parkId, season = "summer", onHeadlineData }: CrowdWindowsProps) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [showTooltip, setShowTooltip] = useState(
    () => !localStorage.getItem(TOOLTIP_KEY)
  );

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, "1");
  }, []);

  if (loading) {
    return (
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 py-3">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading crowd forecasts…</span>
        </div>
      </div>
    );
  }

  if (forecasts.length === 0) return null;


  return (
    <div className="px-5 mb-5">
      {/* First-time tooltip */}
      {showTooltip && (
        <div className="mb-3 flex items-start gap-2.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5 relative">
          <Info size={14} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground leading-snug">
              Swipe to explore crowd windows
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              The colored bar shows when areas are quiet (green), building (yellow), busy (orange), or packed (red). The black marker shows the current time.
            </p>
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

      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-[0.1em]">Crowd Windows</span>
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

      {/* Swipeable carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {forecasts.map((f) => (
            <div key={f.id} className="min-w-0 shrink-0 grow-0 basis-full">
              <ForecastCard f={f} />
            </div>
          ))}
        </div>
      </div>

      {forecasts.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
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

export default CrowdWindows;
