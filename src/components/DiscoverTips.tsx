import { useState, useEffect, useMemo, useCallback, forwardRef } from "react";
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

interface HeroConfig {
  image: string;
  alt: string;
  badge: string;
  title: string;
}

const parkHeroes: Record<string, HeroConfig> = {
  yosemite: { image: yosemiteHero, alt: "Yosemite Half Dome at golden hour", badge: "Featured", title: "Half Dome at Golden Hour" },
  rainier: { image: rainierHero, alt: "Mount Rainier above wildflower meadows", badge: "Featured", title: "Rainier from Paradise Meadows" },
  zion: { image: zionHero, alt: "Zion Narrows slot canyon with Virgin River", badge: "Featured", title: "The Narrows at Golden Hour" },
  glacier: { image: glacierHero, alt: "Glacier National Park turquoise lake and peaks", badge: "Featured", title: "Glacier's Alpine Jewels" },
  rocky_mountain: { image: rockyMountainHero, alt: "Rocky Mountain National Park alpine meadow at sunset", badge: "Featured", title: "Longs Peak at Golden Hour" },
  arches: { image: archesHero, alt: "Delicate Arch in Arches National Park", badge: "Featured", title: "Delicate Arch at Dusk" },
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
    { icon: Snowflake, title: "Season Note", description: "Full road open mid-June to mid-October only." },
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
  const [highlightsOpen, setHighlightsOpen] = useState(true);

  const parkConfig = PARKS[parkId];
  const tripParkConfig = PARKS[tripParkId];
  const seasonContent = parkSeasons[parkId];
  const hero = parkHeroes[parkId];
  const data = useMemo(
    () => seasonContent?.[activeSeason],
    [seasonContent, activeSeason]
  );

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
      <div ref={ref} className="flex flex-col h-full overflow-y-auto" data-tab-scroll>
        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
          <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} />
        </div>
        <div className="flex flex-col flex-1 items-center justify-center text-center px-8 pb-20">
          <TreePine size={40} className="text-muted-foreground/25 mb-4" />
          <p className="text-[15px] font-semibold text-foreground">No data for this park yet</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            Select a different park to explore seasonal tips, crowd windows, and highlights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto" data-tab-scroll>
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
          <span className="text-[9px] font-semibold bg-white/15 backdrop-blur-sm border border-white/20 text-white px-2.5 py-1 rounded-full uppercase tracking-widest">
            {hero.badge}
          </span>
          <h2 className="font-heading text-[26px] font-bold text-white mt-2 leading-tight tracking-tight drop-shadow-sm">
            {hero.title}
          </h2>
          <p className="text-[12px] text-white/60 font-medium mt-1">
            Real-time park guidance to avoid crowds and find permits.
          </p>
        </div>
      </div>

      <div>
      {/* ── PARK INTELLIGENCE PANEL ── */}
      {/* 1 — Today's Park Advice (parking / quiet window summary) */}
      <div className="px-5 mt-8">
        <TodayParkAdvice parkId={parkId} />
      </div>

      {/* 2 — Season Tabs */}
      <div className="px-5 mt-8">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
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
      </div>

      {/* 3 — Today's Crowd Pattern (primary intelligence — extra vertical breathing room) */}
      <div className="mt-10 border-t border-border/30 pt-8 mb-2 px-5">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <CrowdWindows parkId={parkId} season={activeSeason} />
        </div>
      </div>

      {/* 4 — Plan Your Visit */}
      <div className="px-5 mt-14">
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
                className="w-full flex items-center gap-3 rounded-[18px] px-4 py-4 text-left transition-transform duration-[120ms] ease-out active:scale-[0.98]"
                style={{
                  backgroundColor: '#F8F7F5',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0px 1px rgba(0,0,0,0.04)',
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(166,124,109,0.1)' }}>
                  <CalendarIcon size={18} style={{ color: '#A67C6D' }} />
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

      {/* 5 — Seasonal Insight (Mochi guidance) */}
      <div className="px-5 mt-14">
        <div
          className="rounded-xl p-4 flex gap-3"
          style={{
            backgroundColor: '#F8F7F5',
            borderLeft: '4px solid #2F6F4E',
          }}
        >
          <div className="flex-1 min-w-0">
            <span
              className="uppercase tracking-[0.08em] block"
              style={{ fontSize: 10, color: '#3D3D3A', fontWeight: 700 }}
            >
              Seasonal Insight
            </span>
            <h3 className="font-semibold text-[15px] text-foreground leading-snug mt-1">{data.mochiTip.title}</h3>
            <div className="flex gap-2.5 mt-1.5">
              <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{data.mochiTip.body}</p>
              <img
                src="/mochi-map.png"
                alt="Mochi with map"
                className="shrink-0 object-contain self-start"
                style={{ width: 36, height: 36, marginTop: 2 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6 — More About This Park + Ranger Tips */}
      <div className="px-5 mt-8 pb-8">
        <div className="border-t border-border/40 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">More about this park</p>

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
                      const iconColor =
                        card.title.includes("Sunrise") || card.title.includes("Viewpoint") ? "#C97B3F"
                        : card.title.includes("Parking") || card.title.includes("Arrival") ? "#6B7C8D"
                        : card.title.includes("Season") ? "#4A7FA5"
                        : "#2F6F4E";
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Ranger Tips</p>
                    <div className="flex flex-col gap-4">
                      {data.tips.map((tip) => {
                        const Icon = tip.icon;
                        return (
                          <div key={tip.id} className="flex items-start gap-2">
                            <Icon size={16} className="shrink-0 mt-px" style={{ color: '#2F6F4E' }} />
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

          <button
            onClick={() => setHighlightsOpen((prev) => !prev)}
            className="w-full mt-3 text-center text-[11px] text-muted-foreground/50 font-medium hover:text-muted-foreground transition-colors py-1"
          >
            {highlightsOpen ? "Show less ↑" : "Show more ↓"}
          </button>
        </div>
      </div>

      {/* Scanner signal */}
      <div className="px-5 pb-6 flex items-center gap-1.5">
        <Radar size={10} className="text-status-scanning" />
        <span className="text-[10px] text-muted-foreground/50 font-medium">Permit scanner active in Alerts</span>
      </div>
      </div>
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
