import { useState, useEffect, useMemo, useCallback, forwardRef, useRef } from "react";
import ScrollableFooter from "@/components/ScrollableFooter";
import { supabase } from "@/integrations/supabase/client";
import { Share, AlertTriangle, CalendarIcon, Sunrise, Car, Snowflake, Camera, Thermometer, TreePine, CloudSun, ChevronRight, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CrowdWindows from "@/components/CrowdWindows";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { PARKS } from "@/lib/parks";
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
  const [highlightsOpen] = useState(true);
  const [heroForecast, setHeroForecast] = useState<{ location: string; status: string; quietsAfter: string } | null>(null);

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
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} watchedParkIds={watchedParkIds} />
        <button onClick={handleShare} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="Share WildAtlas">
          <Share size={18} />
        </button>
      </div>

      {/* ── Full-bleed Hero Image ── */}
      <div className="relative w-full h-[320px] overflow-hidden mt-3">
        <img
          src={hero.image}
          alt={hero.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-100"
          style={{ objectPosition: hero.objectPosition ?? "center 30%" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 35%)" }} />
        <div className="absolute bottom-5 left-5 right-5">
          {!findsLoading && recentFinds > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: 20,
              padding: '4px 12px',
              marginBottom: 12,
              marginLeft: -2,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#ffffff', whiteSpace: 'nowrap' }}>
                {recentFinds} permit{recentFinds > 1 ? "s" : ""} found in the last {timeWindow}
              </span>
            </div>
          )}
          {(() => {
            const heroText = `${parkConfig.shortName}${heroForecast?.location ? ` · ${heroForecast.location}` : ""}`;
            const heroFontSize = heroText.length <= 20 ? 30 : heroText.length <= 35 ? 24 : 20;
            return (
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: heroFontSize, fontWeight: 400, letterSpacing: "-0.01em", color: "white", lineHeight: 1.2, textShadow: "0px 1px 4px rgba(0,0,0,0.8)" }}>
                {heroText}
              </h2>
            );
          })()}
          {heroForecast && (
            <p className="text-[12px] text-white/80 font-medium mt-1">
              {heroForecast.status} now{heroForecast.quietsAfter ? ` · quiets after ${heroForecast.quietsAfter}` : ""}
            </p>
          )}
        </div>
      </div>

      <div>
      {/* ── PARK INTELLIGENCE PANEL ── */}
      {/* 1 — Today's Park Advice (parking / quiet window summary) */}
      <div style={{ background: "#1A2F1E", padding: "20px 20px" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#A8C4B8', marginTop: 0, marginBottom: 14 }}>Typical Patterns <span style={{ fontSize: 12, marginLeft: 4, fontWeight: 400 }}>ⓘ</span></p>
        <TodayParkAdvice parkId={parkId} darkMode />
      </div>

      {/* 2 — Crowd Pattern (with season tabs inside) */}
      <div className="px-5" style={{ paddingTop: 20 }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--wa-ink-subtle)', marginTop: 0, marginBottom: 14 }}>Plan Ahead</p>
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
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
          <div style={{ background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Top section */}
            <div style={{ padding: '18px 18px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6B6860', marginBottom: 10 }}>Your Upcoming Trip</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#1C1C1A', lineHeight: 1.15 }}>{parkConfig.shortName}</p>
                  <p style={{ fontSize: 12, color: '#6B6860', marginTop: 6 }}>{format(arrivalDate, "MMMM d, yyyy")}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 28, fontWeight: 500, color: '#2F6F4E', lineHeight: 1 }}>
                    {daysUntilTrip <= 0 ? (daysUntilTrip === 0 ? '0' : '✓') : daysUntilTrip}
                  </p>
                  <p style={{ fontSize: 10, letterSpacing: '0.04em', color: '#6B6860', marginTop: 2 }}>
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
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', width: '100%', textDecoration: 'none', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
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

            {/* Poko row */}
            <button
              onClick={() => onNavigateToMochi?.(`What should I know for my ${parkConfig.shortName} trip on ${format(arrivalDate, "MMM d")}?`)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', width: '100%', background: '#EEF5F0', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <img src="/mochi-map.png" alt="Poko" style={{ width: 30, height: 30, flexShrink: 0, objectFit: 'contain' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#2F6F4E', margin: 0 }}>Get Poko's trip briefing →</p>
                <p style={{ fontSize: 11, color: '#5A9070', margin: 0, marginTop: 1 }}>What to know for {parkConfig.shortName} on {format(arrivalDate, "MMM d")}</p>
              </div>
            </button>
          </div>
        ) : (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center gap-3 rounded-[18px] px-4 py-4 text-left transition-transform ease-out active:scale-[0.98]"
                style={{
                  transitionDuration: '120ms',
                  backgroundColor: 'var(--wa-surface-card)',
                  border: '0.5px solid rgba(0,0,0,0.07)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0px 1px rgba(0,0,0,0.04)',
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--wa-surface-green-tint)' }}>
                  <CalendarIcon size={18} style={{ color: 'var(--wa-green)' }} />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-[13px] font-bold text-foreground leading-snug">Plan your visit</p>
                   <p className="text-[10px] text-muted-foreground mt-0.5">Get crowd forecasts and daily briefings for your trip</p>
                </div>
                <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: 'var(--wa-ink-body)' }}>Set date →</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={arrivalDate}
                onSelect={(date) => { handleSetArrivalDate(date); setDatePickerOpen(false); }}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              <p className="px-3 pb-3 text-[12px] text-muted-foreground text-center">
                Setting trip for {parkConfig.shortName}
              </p>
            </PopoverContent>
          </Popover>
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
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: '#F5F0E8',
              borderLeft: '3px solid #2F6F4E',
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
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400, color: "#3D3D3A", lineHeight: 1.65 }}>{data.mochiTip.body}</p>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.08)', marginTop: 12, marginBottom: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12 }}>
              <img src="/mochi-map.png" alt="Poko" style={{ width: 48, height: 'auto', objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#3D3D3A' }}>Poko's pick for {data.label.toLowerCase()}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* divider */}
      <div className="px-5" style={{ paddingTop: 24, paddingBottom: 24 }}><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 6 — More About This Park + Ranger Tips */}
      <div className="px-5 pb-8">
        <div>
          <p className="font-body uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#6B6860', marginTop: 0, marginBottom: 12 }}>Local Knowledge</p>

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
                          style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14 }}
                        >
                          <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
                            <CardIcon size={12} className="shrink-0" style={{ color: '#6B6860' }} />
                            <span className="font-body" style={{ fontSize: 11, fontWeight: 500, color: '#6B6860' }}>{card.title}</span>
                          </div>
                          <p className="font-body" style={{ fontSize: 14, fontWeight: 400, color: '#1C1C1A', lineHeight: 1.5 }}>{card.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ranger Notes */}
                  <div>
                    <p className="font-body uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#6B6860', marginTop: 24, marginBottom: 12 }}>Ranger Notes</p>
                    <div className="flex flex-col">
                      {data.tips.map((tip) => {
                        const Icon = tip.icon;
                        return (
                          <div key={tip.id} className="flex items-start gap-2" style={{ marginBottom: 20 }}>
                            <Icon size={16} className="shrink-0 mt-px" style={{ color: '#2F6F4E' }} />
                            <div className="min-w-0">
                              <h3 className="font-body" style={{ fontWeight: 500, fontSize: 13, color: '#1C1C1A', lineHeight: 1.3, marginBottom: 3 }}>{tip.title}</h3>
                              <p className="font-body" style={{ fontSize: 13, fontWeight: 400, color: '#3D3D3A', lineHeight: 1.6 }}>{tip.body}</p>
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
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
