import { useState, useMemo, useCallback, useEffect, useRef, forwardRef } from "react";
import { Share, AlertTriangle, CalendarIcon, Sunrise, Car, Snowflake, Camera, Thermometer, TreePine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CrowdWindows from "@/components/CrowdWindows";
import CrowdPulse from "@/components/CrowdPulse";
import CrowdReportForm from "@/components/CrowdReportForm";

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
import TodayInParkStrip from "@/components/TodayInParkStrip";
import { getActiveMochiTip } from "@/lib/mochi-tips";
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [rangerTipsExpanded, setRangerTipsExpanded] = useState(false);
  const [dateGlowKey, setDateGlowKey] = useState(0);
  const rangerTipsSectionRef = useRef<HTMLDivElement>(null);

  // Parallax: shift hero image upward as user scrolls content
  const [parallaxY, setParallaxY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setParallaxY(Math.min(el.scrollTop * 0.3, 40));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Reset toggles when park changes
  useEffect(() => {
    setHighlightsOpen(false);
    setRangerTipsExpanded(false);
  }, [parkId]);

  const parkConfig = PARKS[parkId];
  const seasonContent = parkSeasons[parkId];
  const hero = parkHeroes[parkId];
  const data = useMemo(
    () => seasonContent?.[activeSeason],
    [seasonContent, activeSeason]
  );

  const activeMochiTip = useMemo(() => getActiveMochiTip(parkId), [parkId]);

  const daysUntilTrip = useMemo(() => {
    if (!arrivalDate) return null;
    return differenceInDays(arrivalDate, new Date());
  }, [arrivalDate]);

  const handleSetArrivalDate = useCallback((date: Date | undefined) => {
    setArrivalDate(date);
    if (date) {
      localStorage.setItem("wildatlas_arrival_date", date.toISOString());
      setDateGlowKey((k) => k + 1);
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
    <div ref={ref} className="flex flex-col h-full">
      {/* ── HERO IMAGE — full bleed, outside scroll container ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`hero-${parkId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
      <div className="relative h-[230px]" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)", borderRadius: 0, overflow: "hidden" }}>
        <img
          src={hero.image}
          alt={hero.alt}
          className="block w-full object-cover"
          style={{ borderRadius: 0, height: "120%", transform: `translateY(-${parallaxY}px)`, willChange: "transform" }}
        />
        {/* Overlaid controls */}
        <div
          className="absolute z-10"
          style={{ top: "16px", left: "calc(16px + 50vw - 50%)" }}
        >
          <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} variant="overlay" />
        </div>
        <button
          onClick={handleShare}
          className="absolute z-10 p-2 rounded-full text-white"
          style={{ top: "16px", right: "calc(16px + 50vw - 50%)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
          aria-label="Share WildAtlas"
        >
          <Share size={18} />
        </button>
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="absolute bottom-4 flex flex-col" style={{ left: "calc(16px + 50vw - 50%)" }}>
          <h1 className="text-[24px] font-semibold text-white leading-tight">
            {parkConfig.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E11D48] shrink-0" />
            <span className="text-[14px] font-normal text-white">Very Busy Today</span>
          </div>
          <p className="text-[18px] font-semibold text-[#8FCFA6] mt-1.5">
            Arrive before 7:30 AM
          </p>
        </div>
      </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Scrollable content below hero ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" data-tab-scroll>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={parkId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
      {/* ── PARK INTELLIGENCE PANEL ── */}
      {/* 1 — Today's Park Advice (Hero recommendation) */}
      <div className="px-5 mt-5">
        <TodayParkAdvice parkId={parkId} />
      </div>

      {/* 2 — Season Tabs (control for timeline below) */}
      <div className="px-5 mt-4">
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

      {/* 3 — Crowd Windows timeline */}
      <div className="mt-4">
        <CrowdWindows parkId={parkId} season={activeSeason} />
      </div>

      {/* 4 — Visitor Reports */}
      <div className="px-5 mt-5">
        <p className="section-header">Visitor Reports</p>
        <CrowdPulse parkId={parkId} />
      </div>

      {/* 5 — Report Crowd Level */}
      <div className="px-5 mt-6">
        <CrowdReportForm parkId={parkId} />
      </div>

      {/* 6 — Trip Countdown */}
      <div className="px-5 mt-8">
        {arrivalDate && daysUntilTrip !== null ? (
          <div
            key={`countdown-${dateGlowKey}`}
            className={cn(
              "flex items-center gap-3 rounded-[18px] relative overflow-visible",
              dateGlowKey > 0 && "date-glow-active"
            )}
            style={{
              backgroundColor: "#EDE6DC",
              borderLeft: "3px solid #2F5D50",
              padding: "18px",
            }}
          >
            <span className="date-shimmer-bar absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 rounded-[18px]" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] font-body" style={{ color: "#2F5D50" }}>
                Your Trip to {parkConfig.shortName}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-body font-bold text-[22px] leading-none" style={{ color: "#1A3D2B" }}>
                  {daysUntilTrip <= 0
                    ? daysUntilTrip === 0 ? "Today!" : "You're there!"
                    : `${daysUntilTrip} day${daysUntilTrip === 1 ? "" : "s"} remaining`}
                </span>
                <span className="text-[14px] font-body" style={{ color: "#6B7280" }}>
                  · {format(arrivalDate, "MMM d")}
                </span>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-md hover:bg-black/5 transition-colors" style={{ color: "#2F5D50" }}>
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
            {/* Mochi peeking avatar */}
            <img
              src="/assets/mochi/poses/mochi-chilling.png"
              alt=""
              className="absolute -bottom-2 right-1.5 w-9 h-9 object-contain pointer-events-none select-none"
            />
          </div>
        ) : (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center gap-3 bg-secondary/10 border border-secondary/20 rounded-[18px] px-4 py-3.5 hover:bg-secondary/15 transition-colors group text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                  <CalendarIcon size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-[13px] font-bold text-foreground leading-snug">Plan Your Visit</p>
                   <p className="text-[10px] text-muted-foreground mt-0.5">Set your trip date to unlock personalized crowd forecasts and daily park briefings.</p>
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
      </div>

      {/* 7 — Scanner signal */}
      <div className="px-5 mt-5 flex items-center gap-1.5">
        <Radar size={10} className="text-status-scanning" />
        <span className="text-[10px] text-muted-foreground/50 font-medium">Permit scanner active in Alerts</span>
      </div>

      {/* 8 — Park Highlights & Ranger Tips (secondary content) */}
      <div className="px-5 mt-8 pb-8">
        <div className="border-t border-border/40 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 mb-4">More about this park</p>

          {/* Park Highlight Tiles — always visible 2×2 grid */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`grid-${parkId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 gap-2.5"
            >
              {(parkHighlights[parkId] ?? []).map((card, i) => {
                const CardIcon = card.icon;
                return (
                  <motion.div
                    key={`${parkId}-${card.title}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    className="rounded-xl p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center mb-2">
                      <CardIcon size={14} className="text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-[11px] text-foreground/80 leading-snug font-body">{card.title}</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-1 leading-[1.5] font-body">{card.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

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
                <div className="space-y-6 opacity-90 mt-6">
                  {/* Mochi Tip — premium */}
                  <div className="bg-secondary/5 border border-secondary/8 rounded-xl p-4 flex items-start gap-3">
                    <img
                      src="/assets/mochi/chat/mochi-smiling.png"
                      alt="Mochi"
                      className="w-8 h-8 rounded-full object-contain bg-secondary/10 shrink-0 border border-border/40"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium text-[#6B7280]">
                        Mochi's Seasonal Insight
                      </span>
                      <h3 className="font-semibold text-[16px] text-[#1F2937] leading-snug mt-0.5 font-heading">{activeMochiTip.title}</h3>
                      <p className="text-[14px] font-normal text-[#4B5563] mt-1 leading-[1.5]">{activeMochiTip.text}</p>
                    </div>
                  </div>

                   {/* Ranger Tips — smaller tiles with smart expand */}
                  <div ref={rangerTipsSectionRef}>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">QUICK INSIGHTS</p>
                    {(() => {
                      const allTips = data.tips;
                      const VISIBLE_COUNT = 4;
                      const hasMore = allTips.length > VISIBLE_COUNT;
                      const visibleTips = rangerTipsExpanded ? allTips : allTips.slice(0, VISIBLE_COUNT);
                      const hiddenCount = allTips.length - VISIBLE_COUNT;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-x-2.5 gap-y-6">
                            {visibleTips.map((tip, i) => {
                              const Icon = tip.icon;
                              return (
                                <motion.div
                                  key={tip.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="rounded-xl p-3 hover:bg-muted/30 transition-colors flex flex-col"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center mb-2 shrink-0">
                                    <Icon size={12} className="text-muted-foreground" />
                                  </div>
                                  <h3 className="font-semibold text-[15px] text-[#1F2937] leading-snug font-body shrink-0">{tip.title}</h3>
                                  <div className="flex-1">
                                    {tip.signals && tip.signals.length > 0 ? (
                                      <div className="mt-1.5 space-y-0.5">
                                        {tip.signals.map((signal) => (
                                          <p key={signal.label} className="text-[14px] leading-[1.5] font-body">
                                            <span className="font-semibold text-[#1F2937]">{signal.label}:</span>{" "}
                                            <span className="font-normal text-[#4B5563]">{signal.value}</span>
                                          </p>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[14px] font-normal text-[#4B5563] mt-1 leading-[1.5] font-body line-clamp-3">{tip.body}</p>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {hasMore && (
                            <>
                              {rangerTipsExpanded && <div className="h-px bg-border/40 mt-3" />}
                              <button
                                onClick={() => {
                                  if (rangerTipsExpanded) {
                                    // Collapse and scroll back to the section anchor
                                    setRangerTipsExpanded(false);
                                    requestAnimationFrame(() => {
                                      rangerTipsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    });
                                  } else {
                                    setRangerTipsExpanded(true);
                                  }
                                }}
                                className="w-full mt-2 text-center text-[11px] text-muted-foreground/50 font-medium hover:text-muted-foreground transition-colors py-1"
                              >
                                {rangerTipsExpanded ? "Show less ↑" : `View all tips (+${hiddenCount}) →`}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setHighlightsOpen((prev) => !prev)}
            className="w-full mt-3 text-center text-[11px] text-muted-foreground/50 font-medium hover:text-muted-foreground transition-colors py-1"
          >
            {highlightsOpen ? "Show less ↑" : "View all tips →"}
          </button>
        </div>
      </div>
        </motion.div>
      </AnimatePresence>
      </div>{/* end scroll container */}
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
