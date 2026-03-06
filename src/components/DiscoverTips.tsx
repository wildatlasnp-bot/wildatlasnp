import { useState, useMemo, useCallback, forwardRef } from "react";
import { Share, AlertTriangle, User, CalendarIcon, ChevronDown, Sunrise, Car, Snowflake, Camera, Mountain, Clock, Compass, Binoculars, Thermometer, Footprints, Eye, MapPin, Sun, TreePine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CrowdWindows from "@/components/CrowdWindows";
import CrowdPulse from "@/components/CrowdPulse";
import CrowdReportForm from "@/components/CrowdReportForm";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
const SHARE_URL = "https://wildatlasnp.lovable.app";

interface DiscoverProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
  onNavigateToSniper?: () => void;
}

const DiscoverTips = forwardRef<HTMLDivElement, DiscoverProps>(({ parkId = "yosemite", onParkChange, onNavigateToSniper }, ref) => {
  const { displayName } = useAuth();
  const { toast } = useToast();
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem("wildatlas_arrival_date");
    return saved ? new Date(saved) : undefined;
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(true);

  const parkConfig = PARKS[parkId] ?? PARKS.yosemite;
  const seasonContent = parkSeasons[parkId] ?? parkSeasons.yosemite;
  const hero = parkHeroes[parkId] ?? parkHeroes.yosemite;
  const data = useMemo(() => seasonContent[activeSeason], [seasonContent, activeSeason]);

  const daysUntilTrip = useMemo(() => {
    if (!arrivalDate) return null;
    return differenceInDays(arrivalDate, new Date());
  }, [arrivalDate]);

  const handleSetArrivalDate = useCallback((date: Date | undefined) => {
    setArrivalDate(date);
    if (date) {
      localStorage.setItem("wildatlas_arrival_date", date.toISOString());
    } else {
      localStorage.removeItem("wildatlas_arrival_date");
    }
  }, []);

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

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto">
      {/* ── Top bar: park selector + actions ── */}
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <ParkSelector activeParkId={parkId} onParkChange={onParkChange ?? (() => {})} />
        <div className="flex items-center gap-1">
          <a href="/settings" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Settings">
            <User size={18} />
          </a>
          <button onClick={handleShare} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="Share WildAtlas">
            <Share size={18} />
          </button>
        </div>
      </div>

      <p className="px-5 mt-1.5 text-[12px] text-muted-foreground/60 font-medium font-body">
        Real-time park guidance to avoid crowds and find permits.
      </p>

      {/* 1 — Today's Park Advice */}
      <div className="px-5 mt-5">
        <TodayParkAdvice parkId={parkId} />
      </div>

      {/* 2 — Crowd Timeline */}
      <div className="px-5 mt-7">
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
                  <motion.div
                    layoutId="season-pill"
                    className="absolute inset-0 bg-primary rounded-md shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
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

      <AnimatePresence mode="wait">
        <motion.div
          key={`${parkId}-${activeSeason}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mt-4">
            <CrowdWindows parkId={parkId} season={activeSeason} />
          </div>

          {/* 3 — Live Park Status */}
          <div className="px-5 mt-7 mb-2">
            <p className="section-header">Live Park Status</p>
          </div>
          <div className="px-5">
            <CrowdPulse parkId={parkId} />
          </div>

          {/* 4 — Report Crowd Level */}
          <div className="px-5 mt-7">
            <CrowdReportForm parkId={parkId} />
          </div>

          {/* 5 — Trip Countdown */}
          <motion.div
            className="px-5 mt-7"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {arrivalDate && daysUntilTrip !== null ? (
              <div className="flex items-center gap-3 bg-muted/40 border border-border/70 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/85 font-body">
                    Your Trip to {parkConfig.shortName}
                  </p>
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
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="w-full flex items-center gap-3 bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3.5 hover:bg-secondary/15 transition-colors group text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                      <CalendarIcon size={18} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground leading-snug">Set your trip date</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Unlocks your personal trip countdown and daily park briefings.</p>
                    </div>
                    <span className="text-[11px] text-secondary font-bold whitespace-nowrap shrink-0">Set date →</span>
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
                </PopoverContent>
              </Popover>
            )}
          </motion.div>

          {/* 6 — Subtle scanner signal */}
          <div className="px-5 mt-5 flex items-center gap-1.5">
            <Radar size={10} className="text-status-scanning" />
            <span className="text-[10px] text-muted-foreground/50 font-medium">Permit scanner active in Alerts</span>
          </div>

          <div className="px-5 mt-7 pb-8">
            <p className="section-header mb-3">Park Highlights</p>

            <AnimatePresence mode="wait">
              {highlightsOpen && (
                <motion.div
                  key={`highlights-${parkId}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Park Highlight Cards — 2×2 grid */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`grid-${parkId}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="grid grid-cols-2 gap-3"
                      >
                        {(parkHighlights[parkId] ?? parkHighlights.yosemite).map((card, i) => {
                          const CardIcon = card.icon;
                          return (
                            <motion.div
                              key={`${parkId}-${card.title}`}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06, duration: 0.25 }}
                              className="bg-card border border-border/70 rounded-xl p-3.5"
                              style={{ boxShadow: "var(--card-shadow)" }}
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                                <CardIcon size={16} className="text-primary" />
                              </div>
                              <h3 className="font-semibold text-[12px] text-foreground leading-snug font-body">{card.title}</h3>
                              <p className="text-[11px] text-muted-foreground mt-1 leading-[1.5] font-body">{card.description}</p>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    <div className="relative rounded-xl overflow-hidden h-40 shadow-lg">
                      <img src={hero.image} alt={hero.alt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">{hero.badge}</span>
                        <h2 className="font-heading text-base font-bold text-white mt-1.5 leading-snug">{hero.title}</h2>
                      </div>
                    </div>

                    <div className="bg-secondary/8 border border-secondary/15 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={14} className="text-secondary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-secondary uppercase tracking-[0.1em]">
                            {activeSeason} · 🐻 Mochi Tip
                          </span>
                        </div>
                        <h3 className="font-semibold text-[13px] text-foreground leading-snug">{data.mochiTip.title}</h3>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-[1.6]">{data.mochiTip.body}</p>
                      </div>
                    </div>

                    <div>
                      <p className="section-header text-[11px] mb-3">Ranger Tips</p>
                      <div className="grid grid-cols-2 gap-3">
                        {data.tips.map((tip, i) => {
                          const Icon = tip.icon;
                          return (
                            <motion.div
                              key={tip.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="bg-card border border-border/70 rounded-xl p-4"
                              style={{ boxShadow: "var(--card-shadow)" }}
                            >
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mb-2.5">
                                <Icon size={14} className="text-primary" />
                              </div>
                              <h3 className="font-semibold text-[12px] text-foreground leading-snug font-body">{tip.title}</h3>
                              <p className="text-[11px] text-muted-foreground mt-1.5 leading-[1.6] font-body line-clamp-3">{tip.body}</p>
                            </motion.div>
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
              className="w-full mt-3 text-center text-[11px] text-muted-foreground/70 font-medium hover:text-muted-foreground transition-colors py-1"
            >
              {highlightsOpen ? "Show less ↑" : "Show more ↓"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;