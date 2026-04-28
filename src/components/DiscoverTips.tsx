import { useState, useEffect, useMemo, useCallback, forwardRef, useRef } from "react";
import { X } from "lucide-react";
import ScrollableFooter from "@/components/ScrollableFooter";
import { supabase } from "@/integrations/supabase/client";
import { Share2, AlertTriangle, CalendarIcon, Sunrise, Car, Snowflake, Camera, Thermometer, TreePine, CloudSun, ChevronRight, Sun, Compass } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CrowdWindows from "@/components/CrowdWindows";
import TripDateModal from "@/components/TripDateModal";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { PARKS } from "@/lib/parks";
import { getSunEphemeris, getParkLocalTime, getPhotoGradeFilter, getPhotoOverlayColor, formatCoordinates, formatCountdown } from "@/lib/discover-utils";
import PokoReadCard from "@/components/discover/PokoReadCard";
import FieldLog from "@/components/discover/FieldLog";

/** Returns an rgba badge background from a hex color, clamping hue to green range (90°–180°). */
function badgeBg(hex: string | undefined, opacity = 0.85): string {
  const c = hex ?? '#2F6F4E';
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  // Compute hue
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  // If hue outside green/olive range, fall back to #2F6F4E
  if (h < 90 || h > 180) {
    return `rgba(47,111,78,${opacity})`;
  }
  return `rgba(${r},${g},${b},${opacity})`;
}
import ParkSelector from "@/components/ParkSelector";
import { seasons, getCurrentSeason, parkSeasons, type Season } from "@/lib/park-seasons";
import TodayParkAdvice from "@/components/TodayParkAdvice";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import { Radar } from "lucide-react";
import yosemiteHero from "@/assets/yosemite-hero.jpg";
import rainierHero from "@/assets/rainier-hero.jpg";
import zionHero from "@/assets/zion-hero.jpg";
import glacierHero from "@/assets/glacier-hero.jpg";
import rockyMountainHero from "@/assets/rocky-mountain-hero.jpg";
import archesHero from "@/assets/arches-hero.jpg";
import grandCanyonHero from "@/assets/grand-canyon-hero.jpg";
import grandTetonHero from "@/assets/grand-teton-hero.jpg";

function TypicalPatternsHeader() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 14 }}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "#A8C4B8", margin: 0, display: "flex", alignItems: "center", gap: 4 }}
      >
        Typical Patterns
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="About typical patterns data"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#A8C4B8", fontSize: 12, lineHeight: 1 }}
        >
          ⓘ
        </button>
      </p>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#243A28",
            border: "1px solid rgba(168,196,184,0.2)",
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#A8C4B8",
              padding: 2,
            }}
          >
            <X size={12} />
          </button>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "#A8C4B8", paddingRight: 16 }}>
            These times reflect average historical visitor patterns, not live conditions. Check NPS alerts and Recreation.gov for real-time updates.
          </p>
        </div>
      )}
    </div>
  );
}

interface HeroConfig {
  image: string;
  alt: string;
  objectPosition: string;
}

const parkHeroes: Record<string, HeroConfig> = {
  yosemite:      { image: yosemiteHero,      alt: "Yosemite Half Dome at golden hour",                      objectPosition: "center 35%" },
  rainier:       { image: rainierHero,       alt: "Mount Rainier above wildflower meadows",                 objectPosition: "center 25%" },
  zion:          { image: zionHero,          alt: "Zion Narrows slot canyon with Virgin River",             objectPosition: "center 45%" },
  glacier:       { image: glacierHero,       alt: "Glacier National Park turquoise lake and peaks",         objectPosition: "center 25%" },
  rocky_mountain:{ image: rockyMountainHero, alt: "Rocky Mountain National Park alpine meadow at sunset",  objectPosition: "center 35%" },
  arches:        { image: archesHero,        alt: "Delicate Arch in Arches National Park",                  objectPosition: "center 50%" },
  grand_canyon:  { image: grandCanyonHero,   alt: "Grand Canyon South Rim at sunrise",                     objectPosition: "center 40%" },
  grand_teton:   { image: grandTetonHero,    alt: "Grand Teton peaks above Jenny Lake",                    objectPosition: "center 30%" },
};

// Pre-decode all hero images on module load so park switches are instant
const decodedImages = new Set<string>();
function preDecodeHeroImages() {
  Object.values(parkHeroes).forEach((h) => {
    if (decodedImages.has(h.image)) return;
    const img = new Image();
    img.src = h.image;
    img.decode?.().then(() => decodedImages.add(h.image)).catch(() => {});
  });
}
preDecodeHeroImages();

interface HighlightCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

const parkHighlights: Record<string, HighlightCard[]> = {
  yosemite: [
    { icon: Sunrise, title: "Best Sunrise Spot", description: "Glacier Point for unobstructed valley views." },
    { icon: Car, title: "Parking Tip", description: "Valley lots fill by 8am on weekends." },
    { icon: Snowflake, title: "Season Note", description: "Tioga Road closed November through May." },
    { icon: Camera, title: "Hidden Gem", description: "Mirror Lake trail quietest before 7am." },
  ],
  rainier: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Sunrise Point for dawn alpenglow on the summit." },
    { icon: Car, title: "Arrival Tip", description: "Paradise lot full by 10am June–September." },
    { icon: Snowflake, title: "Season Note", description: "Most roads close mid-November to late May." },
    { icon: Camera, title: "Hidden Gem", description: "Spray Park meadows rival Paradise with fewer crowds." },
  ],
  zion: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Canyon Overlook Trail for sunrise valley panoramas." },
    { icon: Car, title: "Parking Tip", description: "Use Springdale shuttle; visitor center lot fills by 8am." },
    { icon: Thermometer, title: "Season Note", description: "Summer temps exceed 105°F on exposed trails." },
    { icon: Camera, title: "Hidden Gem", description: "Observation Point via East Mesa quietest at dawn." },
  ],
  glacier: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Logan Pass for sunrise over Hidden Lake." },
    { icon: Car, title: "Arrival Tip", description: "Going-to-the-Sun Road requires vehicle reservation." },
    { icon: Snowflake, title: "Season Note", description: "Full road typically open early July through mid-October." },
    { icon: Camera, title: "Hidden Gem", description: "Iceberg Lake trail sees half the Highline crowds." },
  ],
  rocky_mountain: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Trail Ridge Road pullouts for alpine sunrise views." },
    { icon: Car, title: "Arrival Tip", description: "Bear Lake corridor needs timed entry by 9am." },
    { icon: TreePine, title: "Season Note", description: "Elk rut in late September draws large crowds." },
    { icon: Camera, title: "Hidden Gem", description: "Wild Basin trails are quieter than Bear Lake." },
  ],
  arches: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Delicate Arch at sunset is a must-see experience." },
    { icon: Car, title: "Arrival Tip", description: "Timed entry required April through October." },
    { icon: Thermometer, title: "Season Note", description: "Summer ground temps exceed 130°F on slickrock." },
    { icon: Camera, title: "Hidden Gem", description: "Tower Arch via back road avoids all crowds." },
  ],
  grand_canyon: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Mather Point at sunrise before crowds arrive." },
    { icon: Car, title: "Parking Tip", description: "Visitor Center lot fills by 9 AM peak season." },
    { icon: Thermometer, title: "Season Note", description: "Inner canyon hits 115°F — hike before 7 AM in summer." },
    { icon: Camera, title: "Hidden Gem", description: "Desert View Watchtower is 25 miles east with far fewer crowds." },
  ],
  grand_teton: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Schwabacher Landing at dawn for Teton reflections." },
    { icon: Car, title: "Parking Tip", description: "Jenny Lake fills by 8 AM — String Lake is the backup." },
    { icon: Snowflake, title: "Season Note", description: "Teton Park Road closes November 1 through April." },
    { icon: Camera, title: "Hidden Gem", description: "Phelps Lake overlook trail avoids all Jenny Lake crowds." },
  ],
};

const SHARE_TITLE = "WildAtlas - National Park Permit Alerts";
const SHARE_TEXT = "Check out WildAtlas — I'm using it to track national park permit cancellations. Join here:";
const SHARE_URL = "https://wildatlas.app";

const SeasonalBlurb = ({ body }: { body: string }) => {
  const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [body];
  const needsCollapse = sentences.length > 3;
  const preview = needsCollapse ? sentences.slice(0, 3).join("") : body;
  const [expanded, setExpanded] = useState(!needsCollapse);
  return (
    <>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400, color: "#3D3D3A", lineHeight: 1.65 }}>
        {expanded ? body : preview}
      </p>
      {needsCollapse && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#2F6F4E", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 4 }}
        >
          Read more
        </button>
      )}
    </>
  );
};

interface DiscoverProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
  onNavigateToSniper?: () => void;
  onNavigateToMochi?: (query?: string) => void;
}

const NOOP_PARK_CHANGE = () => {};

const DiscoverTips = forwardRef<HTMLDivElement, DiscoverProps>(({ parkId = "yosemite", onParkChange, onNavigateToSniper, onNavigateToMochi }, ref) => {
  const stableParkChange = onParkChange ?? NOOP_PARK_CHANGE;
  const { displayName, user } = useAuth();
  const { toast } = useToast();

  // Lightweight watched-park-ids for ParkSelector indicator dots
  const [watchedParkIds, setWatchedParkIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_watchers")
      .select("scan_targets(park_id)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const ids = new Set<string>(data.map((r: any) => r.scan_targets?.park_id).filter(Boolean));
          setWatchedParkIds(ids);
        }
      });
  }, [user]);
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem("wildatlas_arrival_date");
    if (!saved) return undefined;
    const date = new Date(saved);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    if (normalized < today) {
      localStorage.removeItem("wildatlas_arrival_date");
      localStorage.removeItem("wildatlas_trip_park");
      return undefined;
    }
    return date;
  });
  // tripParkId is seeded from localStorage at the save-time park; synced in-memory to the
  // current browse park via useEffect below, but localStorage is never rewritten on browse.
  const [tripParkId, setTripParkId] = useState<string>(
    () => localStorage.getItem("wildatlas_trip_park") || parkId
  );

  // Sync tripParkId in-memory when the user browses to a different park while a trip is set.
  // localStorage is intentionally not updated here — it stays pinned to the save-time park.
  useEffect(() => {
    if (arrivalDate && parkId !== tripParkId) {
      setTripParkId(parkId);
    }
  }, [parkId, arrivalDate]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tripModalOpen, setTripModalOpen] = useState(false);

  const handleTripModalSave = useCallback((modalParkId: string, date: Date) => {
    setArrivalDate(date);
    localStorage.setItem("wildatlas_arrival_date", date.toISOString());
    localStorage.setItem("wildatlas_trip_park", modalParkId);
    setTripParkId(modalParkId);
  }, []);

  const handleTripRemove = useCallback(() => {
    setArrivalDate(undefined);
    localStorage.removeItem("wildatlas_arrival_date");
    localStorage.removeItem("wildatlas_trip_park");
  }, []);
  const [highlightsOpen] = useState(true);
  const [heroForecast, setHeroForecast] = useState<{ location: string; status: string; quietsAfter: string } | null>(null);

  // Live tick — drives hero telemetry, sun phase, countdowns. 60s cadence is enough.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sun = useMemo(() => getSunEphemeris(parkId, now), [parkId, now]);
  const localTime = useMemo(() => getParkLocalTime(parkId, now), [parkId, now]);
  const photoFilter = useMemo(() => getPhotoGradeFilter(sun.phase), [sun.phase]);
  const photoOverlay = useMemo(() => getPhotoOverlayColor(sun.phase), [sun.phase]);
  const coords = useMemo(() => formatCoordinates(parkId), [parkId]);


  const parkConfig = PARKS[parkId];
  const tripParkConfig = PARKS[tripParkId];
  const seasonContent = parkSeasons[parkId];
  const hero = parkHeroes[parkId];
  const data = useMemo(
    () => seasonContent?.[activeSeason],
    [seasonContent, activeSeason]
  );

  // Fetch first forecast location for hero subtitle
  useEffect(() => {
    setHeroForecast(null);
    const season = getCurrentSeason();
    const dayType = new Date().getDay() === 0 || new Date().getDay() === 6 ? "weekend" : "weekday";
    const load = async () => {
      const { data: rows } = await supabase
        .from("park_crowd_forecasts")
        .select("location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("display_order")
        .limit(1);
      const f = rows?.[0];
      if (!f) return;
      // All times equal means closed
      if (f.peak_start === f.peak_end && f.building_time === f.peak_start) return;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const toMin = (t: string) => {
        const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return 0;
        let h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
        if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        return h * 60 + mm;
      };
      const qs = toMin(f.quiet_start);
      const qe = toMin(f.quiet_end);
      const ps = toMin(f.peak_start);
      const pe = toMin(f.peak_end);
      let status: string;
      let quietsAfter: string;
      if (nowMin < qs || nowMin >= toMin(f.evening_quiet)) {
        status = "Quiet";
        quietsAfter = "";
      } else if (nowMin < qe) {
        status = "Quiet";
        quietsAfter = "";
      } else if (nowMin < ps) {
        status = "Building";
        quietsAfter = f.evening_quiet;
      } else if (nowMin < pe) {
        status = "Busy";
        quietsAfter = f.evening_quiet;
      } else {
        status = "Winding down";
        quietsAfter = f.evening_quiet;
      }
      setHeroForecast({ location: f.location_name, status, quietsAfter });
    };
    load();
  }, [parkId]);

  const daysUntilTrip = useMemo(() => {
    if (!arrivalDate) return null;
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const arrivalLocal = new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), arrivalDate.getDate());
    return differenceInDays(arrivalLocal, todayLocal);
  }, [arrivalDate]);

  const { todayCount: recentFinds, loading: findsLoading } = useRecentFinds(parkId);
  const timeWindow = "24h";

  const handleSetArrivalDate = useCallback((date: Date | undefined) => {
    setArrivalDate(date);
    if (date) {
      localStorage.setItem("wildatlas_arrival_date", date.toISOString());
      // Capture the park the user is browsing at the moment they set the date.
      // This is the only place tripParkId is written — it does not update on browse-park changes.
      localStorage.setItem("wildatlas_trip_park", parkId);
      setTripParkId(parkId);
    } else {
      localStorage.removeItem("wildatlas_arrival_date");
      localStorage.removeItem("wildatlas_trip_park");
    }
  }, [parkId]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
      } catch (_) { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
    }
  };

  if (!parkConfig || !seasonContent || !hero || !data) {
    return (
      <div ref={ref} className="h-full min-h-0 overflow-y-auto" data-tab-scroll>
        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
          <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} watchedParkIds={watchedParkIds} />
        </div>
        <div className="flex flex-col flex-1 items-center justify-center text-center px-8 pb-20">
          <div className="max-w-[280px] mx-auto">
            <img
              src="/mochi-map.png"
              alt="Poko with map"
              style={{ width: "min(120px, 28vw)", height: "auto", objectFit: "contain" }}
              className="mx-auto mb-3"
              loading="lazy"
            />
            <p className="font-heading font-bold text-foreground text-lg mb-2">Your permits, on watch.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Poko scans for openings around the clock. Set up an alert and we'll notify you the moment a permit drops.
            </p>
            <button
              onClick={() => onNavigateToSniper?.()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              Set Up Your First Alert
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="h-full min-h-0 overflow-y-auto" data-tab-scroll style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
      {/* ── Top bar: park selector + actions ── */}
      <div className="px-5 pb-0 flex items-center justify-between" style={{ paddingTop: 12, borderBottom: '1px solid #E8E3DD' }}>
        <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} watchedParkIds={watchedParkIds} />
        <button onClick={handleShare} className="p-2 rounded-lg hover:bg-primary/10 transition-colors" aria-label="Share WildAtlas">
          <Share2 size={18} color="#2F6F4E" />
        </button>
      </div>

      {/* ── Full-bleed Hero Image (time-of-day color graded) ── */}
      <div className="relative w-full h-[380px] overflow-hidden mt-3">
        <img
          src={hero.image}
          alt={hero.alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: hero.objectPosition ?? "center 30%",
            filter: photoFilter,
            transform: 'scale(1.06)',
            animation: 'kenBurnsDrift 38s ease-in-out infinite alternate',
            transition: 'filter 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Phase-driven overlay */}
        <div className="absolute inset-0" style={{ background: photoOverlay, zIndex: 1, transition: 'background 1200ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
        <div className="park-photo-scrim" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${parkConfig.primaryColor ?? '#2F6F4E'}b3 0%, ${parkConfig.primaryColor ?? '#2F6F4E'}26 38%, transparent 68%)`, zIndex: 2 }} />

        {/* Top-left: gold hairline + eyebrow (FIELD REPORT · date · weekday) */}
        <div className="absolute top-5 left-5 right-5" style={{ zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ height: 1, width: 24, background: '#C9A96E', opacity: 0.85 }} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              Field Report · {localTime.dateLabel} · {localTime.weekday}
            </span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', marginTop: 6, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {coords}
          </p>
        </div>

        {/* Bottom: editorial title stack */}
        <div className="absolute bottom-6 left-5 right-5" style={{ zIndex: 10 }}>
          {(() => {
            const heroText = `${parkConfig.shortName}${heroForecast?.location ? ` · ${heroForecast.location}` : ""}`;
            const heroFontSize = heroText.length <= 20 ? 38 : heroText.length <= 35 ? 30 : 24;
            return (
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: heroFontSize, fontStyle: 'italic', fontWeight: 400, letterSpacing: "-0.015em", color: "white", lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}>
                {heroText}
              </h2>
            );
          })()}
          {heroForecast && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: badgeBg(parkConfig.primaryColor),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: 20,
              padding: '4px 12px',
              marginTop: 10,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                flexShrink: 0,
                background: heroForecast.status === "Busy" ? "var(--wa-crowd-busy)"
                  : heroForecast.status === "Building" ? "var(--wa-crowd-building)"
                  : heroForecast.status === "Packed" ? "var(--wa-crowd-packed)"
                  : "var(--wa-crowd-quiet)",
              }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#ffffff', whiteSpace: 'nowrap' }}>
                {heroForecast.status} now{heroForecast.quietsAfter ? ` · quiets after ${heroForecast.quietsAfter}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Telemetry strip (sun ephemeris) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        background: '#1A2F1E',
        borderTop: '1px solid rgba(201,169,110,0.35)',
        borderBottom: '1px solid rgba(201,169,110,0.18)',
        padding: '10px 16px',
      }}>
        {[
          { eyebrow: 'Local time', value: `${((localTime.hour + 11) % 12 + 1)}:${String(localTime.minute).padStart(2, '0')}${localTime.hour < 12 ? 'a' : 'p'}` },
          { eyebrow: 'Sunrise', value: sun.sunriseLabel },
          { eyebrow: sun.nextEventLabel === 'Sunrise' ? `Until sunrise` : 'Until sunset', value: formatCountdown(sun.minutesToNextEvent) },
        ].map((item, i) => (
          <div key={item.eyebrow} style={{ textAlign: 'center', borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(168,196,184,0.75)', textTransform: 'uppercase', margin: 0, marginBottom: 3 }}>{item.eyebrow}</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400, color: '#F0EDEA', letterSpacing: '-0.01em', margin: 0, lineHeight: 1.1 }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Permit-found bar (editorial field-log strip) ── */}
      {!findsLoading && recentFinds > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(47,111,78,0.08)',
            padding: '11px 20px',
            borderBottom: '1px solid rgba(201,169,110,0.25)',
          }}
        >
          <div style={{ height: 1, width: 14, background: '#C9A96E' }} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: '#2F6F4E', textTransform: 'uppercase' }}>
            Logged
          </span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: '#2F6F4E', flex: 1 }}>
            {recentFinds} permit{recentFinds > 1 ? "s" : ""} found · last {timeWindow}
          </span>
          <button
            onClick={() => onNavigateToSniper?.()}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
          >
            View →
          </button>
        </div>
      )}

      {/* ── Poko's Read (single-sentence AI brief) ── */}
      <div className="px-5" style={{ paddingTop: 18, paddingBottom: 4 }}>
        <PokoReadCard parkId={parkId} parkShortName={parkConfig.shortName} onAskPoko={onNavigateToMochi} />
      </div>

      {/* ── Field Log (live signals) ── */}
      <div className="px-5" style={{ paddingTop: 14 }}>
        <FieldLog parkId={parkId} onNavigateToSniper={onNavigateToSniper} />
      </div>

      <div>
      {/* ── PARK INTELLIGENCE PANEL ── */}
      {/* 1 — Today's Park Advice (parking / quiet window summary) */}
      <div style={{ background: "#1A2F1E", padding: "20px 20px" }}>
        <TypicalPatternsHeader />
        <TodayParkAdvice parkId={parkId} darkMode />
      </div>

      {/* 2 — Crowd Pattern (with season tabs inside) */}
      <div className="px-5" style={{ paddingTop: 20 }}>
        <div style={{ borderTop: '1px solid #D4CFC9', paddingTop: 16, marginTop: 4 }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--wa-ink-subtle)', marginTop: 0, marginBottom: 14 }}>Plan Ahead</p>
        </div>
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <CrowdWindows parkId={parkId} season={activeSeason}>
            <div className="flex bg-muted rounded-[10px] p-1 gap-1 mb-3">
              {seasons.map((s) => {
                const SeasonIcon = seasonContent[s].icon;
                const isActive = s === activeSeason;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSeason(s)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-primary rounded-md shadow-sm" />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <SeasonIcon size={13} />
                      {seasonContent[s].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CrowdWindows>
        </div>
      </div>

      {/* divider */}
      <div className="px-5 py-6"><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 4 — Plan Your Visit */}
      <div className="px-5">
        {arrivalDate && daysUntilTrip !== null ? (
          <>
          <div style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Top section */}
            <div style={{ padding: '18px 18px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6B6860', marginBottom: 10 }}>Your Upcoming Trip</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: '#1C1C1A', lineHeight: 1.15 }}>{parkConfig.shortName}</p>
                  <p style={{ fontSize: 12, color: '#6B6860', marginTop: 6, margin: 0 }}>
                    {format(arrivalDate, "MMMM d, yyyy")}
                    <button
                      onClick={() => setTripModalOpen(true)}
                      style={{ fontSize: 12, fontWeight: 500, color: '#2F6F4E', background: 'transparent', padding: 0, border: 'none', cursor: 'pointer', marginLeft: 4 }}
                    >
                      · Edit
                    </button>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 28, fontWeight: 500, color: '#2F6F4E', lineHeight: 1 }}>
                    {daysUntilTrip <= 0 ? (daysUntilTrip === 0 ? '0' : '✓') : daysUntilTrip}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: '#6B6860', marginTop: 2 }}>
                    {daysUntilTrip <= 0 ? (daysUntilTrip === 0 ? 'TODAY' : "YOU'RE THERE") : 'DAYS LEFT'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action rows */}
            <div style={{ padding: '4px 0' }}>
              {/* Permit availability */}
              <button
                onClick={() => onNavigateToSniper?.()}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', width: '100%', background: 'none', border: 'none', borderBottom: '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F5F2EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarIcon size={16} style={{ color: '#2F6F4E' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1A', margin: 0 }}>Permit availability</p>
                  <p style={{ fontSize: 11, color: '#6B6860', margin: 0, marginTop: 1 }}>Check open dates around {format(arrivalDate, "MMM d")}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#2F6F4E', whiteSpace: 'nowrap' }}>Check →</span>
              </button>

              {/* Weather */}
              <a
                href={`https://www.nps.gov/${parkConfig.npsCode || parkId}/planyourvisit/weather.htm`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', width: '100%', textDecoration: 'none' }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F5F2EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sun size={16} style={{ color: '#2F6F4E' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1A', margin: 0 }}>{format(arrivalDate, "MMM d")} forecast</p>
                  <p style={{ fontSize: 11, color: '#6B6860', margin: 0, marginTop: 1 }}>South Rim · NPS weather</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#2F6F4E', whiteSpace: 'nowrap' }}>View →</span>
              </a>
            </div>
          </div>

          {/* Poko CTA button — outside card */}
          <button
            onClick={() => onNavigateToMochi?.(`What should I know for my ${parkConfig.shortName} trip on ${format(arrivalDate, "MMM d")}?`)}
            className="hover:brightness-95 active:scale-[0.98] transition-all"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              width: '100%',
              background: '#2F6F4E',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              textAlign: 'left',
              marginTop: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#265E41'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2F6F4E'; }}
          >
            <img src="/mochi-map.png" alt="Poko" style={{ width: 32, height: 32, flexShrink: 0, objectFit: 'contain' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Get Poko's trip briefing</p>
              <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', margin: 0, marginTop: 2 }}>What to know for {parkConfig.shortName} on {format(arrivalDate, "MMM d")}</p>
            </div>
            <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
          </button>
          </>
        ) : (
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px dashed rgba(0,0,0,0.15)', borderRadius: 14, padding: '24px 18px', textAlign: 'center' }}>
            <CalendarIcon size={28} strokeWidth={1.5} style={{ color: '#6B6860', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Planning a trip?</p>
            <p style={{ fontSize: 13, color: '#6B6860', lineHeight: 1.55, marginBottom: 16 }}>Add your target date and Poko will brief you on what to expect — permits, crowds, and conditions.</p>
            <button
              onClick={() => setTripModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', background: '#2F6F4E', color: '#fff', fontSize: 13, fontWeight: 500, padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer' }}
            >
              + Add trip date
            </button>
          </div>
        )}
      </div>

      {/* divider */}
      <div className="px-5 py-6"><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 5 — Seasonal Insight (Mochi guidance) */}
      <div className="px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`mochi-${parkId}-${activeSeason}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl"
            style={{
              backgroundColor: '#F5F0E8',
              borderLeft: '3px solid #1A2F1E',
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              padding: '20px 20px 16px 20px',
            }}
          >
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: "#1C1C1A", letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 10 }}>
              {(() => {
                const seasonLabel = data.mochiTip.title.replace(/\s?(tip|alert)$/i, '');
                return `${seasonLabel} in ${parkConfig.shortName}`;
              })()}
            </h3>
            <SeasonalBlurb body={data.mochiTip.body ?? ""} />
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.08)', marginTop: 12, marginBottom: 0 }} />
            <div style={{ paddingTop: 12 }}>
              <button
                onClick={() => onNavigateToMochi?.(`Tell me Poko's pick for ${data.label.toLowerCase()} in ${parkConfig.shortName}`)}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontStyle: 'italic', color: '#C9A96E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(201,169,110,0.4)' }}
              >
                Poko's pick for {data.label.toLowerCase()} →
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* divider */}
      <div className="px-5" style={{ paddingTop: 24, paddingBottom: 24 }}><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 6 — More About This Park + Ranger Tips */}
      <div className="px-5 pb-8">
        <div>
          <p className="font-body uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: '#6B6860', marginTop: 0, marginBottom: 12, paddingTop: 16, borderTop: '1px solid #D4CFC9' }}>Local Knowledge</p>

          <AnimatePresence mode="wait" initial={false}>
            {highlightsOpen && (
              <motion.div
                key={`highlights-${parkId}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div>
                  <div className="grid grid-cols-2" style={{ gap: 8 }}>
                    {(parkHighlights[parkId] ?? []).map((card) => {
                      const CardIcon = card.icon;
                      return (
                        <div
                          key={`${parkId}-${card.title}`}
                          style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 12, padding: 14, minHeight: 130, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                        >
                          <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
                            <CardIcon size={12} className="shrink-0" style={{ color: '#6B6860' }} />
                            <span className="font-body" style={{ fontSize: 11, fontWeight: 500, color: '#6B6860' }}>{card.title}</span>
                          </div>
                          <p className="font-body" style={{ fontSize: 14, fontWeight: 400, color: '#1C1C1A', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ranger Notes */}
                  <div>
                    <p className="font-body uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: '#6B6860', marginTop: 24, marginBottom: 12, paddingTop: 16, borderTop: '1px solid #D4CFC9' }}>Ranger Notes</p>
                    <div className="flex flex-col">
                      {data.tips.map((tip, idx) => {
                        const Icon = tip.icon;
                        const isLast = idx === data.tips.length - 1;
                        return (
                          <div key={tip.id} style={{ paddingBottom: 18, marginBottom: isLast ? 0 : 18, borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.08)' }}>
                            <div className="flex items-start gap-2">
                              <Icon size={16} className="shrink-0 mt-px" style={{ color: '#2F6F4E' }} />
                              <div className="min-w-0">
                                <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 13, color: '#3D3D3A', lineHeight: 1.3, margin: '0 0 3px 0' }}>{tip.title}</p>
                                <p className="font-body" style={{ fontSize: 13, fontWeight: 400, color: '#3D3D3A', lineHeight: 1.6, margin: 0 }}>{tip.body}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Scanner signal */}
      <div className="px-5 pt-4 pb-6 flex items-center gap-1.5">
        <Radar size={10} style={{ color: 'var(--wa-ink-subtle)' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--wa-ink-subtle)' }}>Permit scanner active in Alerts</span>
      </div>
      </div>
      <TripDateModal
        open={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        onSave={handleTripModalSave}
        onRemove={handleTripRemove}
        initialParkId={parkId}
        initialDate={arrivalDate}
        isEditMode={!!arrivalDate}
      />
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
