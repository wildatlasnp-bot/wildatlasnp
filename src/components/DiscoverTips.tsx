import { useState, useEffect, useMemo, useCallback, forwardRef } from "react";
import ScrollableFooter from "@/components/ScrollableFooter";
import { supabase } from "@/integrations/supabase/client";
import { Share, AlertTriangle, CalendarIcon, Sunrise, Car, Snowflake, Camera, Thermometer, TreePine } from "lucide-react";
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
}

const parkHeroes: Record<string, HeroConfig> = {
  yosemite: { image: yosemiteHero, alt: "Yosemite Half Dome at golden hour" },
  rainier: { image: rainierHero, alt: "Mount Rainier above wildflower meadows" },
  zion: { image: zionHero, alt: "Zion Narrows slot canyon with Virgin River" },
  glacier: { image: glacierHero, alt: "Glacier National Park turquoise lake and peaks" },
  rocky_mountain: { image: rockyMountainHero, alt: "Rocky Mountain National Park alpine meadow at sunset" },
  arches: { image: archesHero, alt: "Delicate Arch in Arches National Park" },
  grand_canyon: { image: grandCanyonHero, alt: "Grand Canyon South Rim at sunrise" },
  grand_teton: { image: grandTetonHero, alt: "Grand Teton peaks above Jenny Lake" },
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
}

const NOOP_PARK_CHANGE = () => {};

const DiscoverTips = forwardRef<HTMLDivElement, DiscoverProps>(({ parkId = "yosemite", onParkChange, onNavigateToSniper }, ref) => {
  const stableParkChange = onParkChange ?? NOOP_PARK_CHANGE;
  const { displayName } = useAuth();
  const { toast } = useToast();
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem("wildatlas_arrival_date");
    return saved ? new Date(saved) : undefined;
  });
  // tripParkId is set when the user saves a date and never changes when the browse park changes.
  // Seeded from its own localStorage key so it survives refreshes independently of parkId.
  const [tripParkId, setTripParkId] = useState<string>(
    () => localStorage.getItem("wildatlas_trip_park") || parkId
  );
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
    return differenceInDays(arrivalDate, new Date());
  }, [arrivalDate]);

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
          <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} />
        </div>
        <div className="flex flex-col flex-1 items-center justify-center text-center px-8 pb-20">
          <div className="max-w-[280px] mx-auto">
            <img
              src="/mochi-map.png"
              alt="Mochi with map"
              style={{ width: "min(120px, 28vw)", height: "auto", objectFit: "contain" }}
              className="mx-auto mb-3"
              loading="lazy"
            />
            <p className="font-heading font-bold text-foreground text-lg mb-2">Your permits, on watch.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Mochi scans for openings around the clock. Set up an alert and we'll notify you the moment a permit drops.
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
        <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} />
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
          style={{ objectPosition: "center 30%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5">
          <h2 className="font-heading text-[26px] font-bold text-white leading-tight tracking-tight drop-shadow-sm">
            {parkConfig.shortName} · {heroForecast?.location ?? ""}
          </h2>
          {heroForecast && (
            <p className="text-[12px] text-white/60 font-medium mt-1">
              {heroForecast.status} now{heroForecast.quietsAfter ? ` · quiets after ${heroForecast.quietsAfter}` : ""}
            </p>
          )}
        </div>
      </div>

      <div>
      {/* ── PARK INTELLIGENCE PANEL ── */}
      {/* 1 — Today's Park Advice (parking / quiet window summary) */}
      <div className="px-5 pt-6">
        <TodayParkAdvice parkId={parkId} />
      </div>

      {/* divider */}
      <div className="px-5 py-6"><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 2 — Crowd Pattern (with season tabs inside) */}
      <div className="px-5">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <CrowdWindows parkId={parkId} season={activeSeason}>
            <div className="flex bg-muted rounded-lg p-1 gap-1 mb-3">
              {seasons.map((s) => {
                const SeasonIcon = seasonContent[s].icon;
                const isActive = s === activeSeason;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSeason(s)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
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
          <div className="flex items-center gap-3 bg-muted/40 border border-border/70 rounded-[18px] px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/85 font-body">
                Your Upcoming Trip
              </p>
              {tripParkConfig && (
                <p className="text-[11px] font-semibold text-foreground/75 font-body leading-none mt-0.5">
                  {tripParkConfig.shortName}
                </p>
              )}
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-body font-bold text-[14px] text-foreground leading-none">
                  {daysUntilTrip <= 0
                    ? daysUntilTrip === 0 ? "Today!" : "You're there!"
                    : `${daysUntilTrip} day${daysUntilTrip === 1 ? "" : "s"} remaining`}
                </span>
                <span className="text-[11px] text-muted-foreground font-body">
                  · {format(arrivalDate, "MMM d")}
                </span>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                  <CalendarIcon size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={arrivalDate}
                  onSelect={handleSetArrivalDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                <p className="px-3 pb-3 text-[12px] text-muted-foreground text-center">
                  Setting trip for {parkConfig.shortName}
                </p>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center gap-3 rounded-[18px] px-4 py-4 text-left transition-transform ease-out active:scale-[0.98] relative"
                style={{
                  transitionDuration: '120ms',
                  backgroundColor: '#F8F7F5',
                  border: '1px solid rgba(47,111,78,0.25)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0px 1px rgba(0,0,0,0.04)',
                }}
              >
                <span className="absolute top-3 right-3 font-body" style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#2F6F4E', color: '#FFFFFF' }}>Pro</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EAF3DE' }}>
                  <CalendarIcon size={18} style={{ color: '#2F6F4E' }} />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-[13px] font-bold text-foreground leading-snug">Plan your visit</p>
                   <p className="text-[10px] text-muted-foreground mt-0.5">Unlock personalized crowd forecasts and daily briefings</p>
                </div>
                <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: '#3d3d3d' }}>Set date →</span>
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
            className="rounded-xl p-4 flex gap-3 items-center overflow-visible"
            style={{
              backgroundColor: '#F8F7F5',
              borderLeft: '4px solid #2F6F4E',
            }}
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[15px] text-foreground leading-snug">{data.mochiTip.title.replace(/\s(\w+)$/, (_m, w) => ` ${w.toLowerCase()}`)}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5">{data.mochiTip.body}</p>
            </div>
            <img
              src="/mochi-map.png"
              alt="Mochi with map"
              className="shrink-0 object-contain"
              style={{ width: 72, height: 72 }}
              loading="lazy"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* divider */}
      <div className="px-5 py-6"><div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} /></div>

      {/* 6 — More About This Park + Ranger Tips */}
      <div className="px-5 pb-8">
        <div>
          <p className="text-[10px] font-bold tracking-widest mb-4" style={{ color: '#3D3D3A' }}>More about this park</p>

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
                <div className="space-y-6 opacity-90">
                  {/* Park Highlight Tiles — borderless 2×2 grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {(parkHighlights[parkId] ?? []).map((card, i) => {
                      const CardIcon = card.icon;
                      const iconColor = "#2F6F4E";
                      return (
                        <div
                          key={`${parkId}-${card.title}`}
                          className="rounded-xl p-4"
                          style={{ backgroundColor: "#F8F7F5", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                        >
                          <div className="flex items-center gap-2">
                            <CardIcon size={16} className="shrink-0" style={{ color: iconColor }} />
                            <h3 className="font-semibold text-[11px] text-foreground/80 leading-snug font-body">{card.title}</h3>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-[1.5] font-body">{card.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ranger Tips */}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: '#3D3D3A' }}>Ranger tips</p>
                    <div className="flex flex-col gap-4">
                      {data.tips.map((tip) => {
                        const Icon = tip.icon;
                        return (
                          <div key={tip.id} className="flex items-start gap-2">
                            <Icon size={16} className="shrink-0 mt-px" style={{ color: tip.icon === AlertTriangle ? '#BA7517' : '#2F6F4E' }} />
                            <div className="min-w-0">
                              <h3 className="font-semibold text-[11px] text-foreground/80 leading-snug font-body">{tip.title}</h3>
                              <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-[1.5] font-body">{tip.body}</p>
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
        <Radar size={10} style={{ color: '#888780' }} />
        <span className="text-[12px] font-medium" style={{ color: '#888780' }}>Permit scanner active in Alerts</span>
      </div>
      </div>
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
