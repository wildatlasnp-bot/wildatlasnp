import { useState, useMemo, useCallback, forwardRef } from "react";
import { Share, AlertTriangle, User, CalendarIcon, Sun } from "lucide-react";
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
import DecisionHeroCard from "@/components/DecisionHeroCard";
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

const SHARE_TITLE = "WildAtlas - National Park Permit Sniper";
const SHARE_TEXT = "Check out WildAtlas — I'm using it to snipe national park permit cancellations. Join here:";
const SHARE_URL = "https://wildatlasnp.lovable.app";

interface DiscoverProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
}

const DiscoverTips = forwardRef<HTMLDivElement, DiscoverProps>(({ parkId = "yosemite", onParkChange }, ref) => {
  const { displayName } = useAuth();
  const { toast } = useToast();
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem("wildatlas_arrival_date");
    return saved ? new Date(saved) : undefined;
  });
  const [headlineData, setHeadlineData] = useState<{ location: string; quietStart: string; quietEnd: string; buildingTime: string; peakStart: string; eveningQuiet: string } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const parkConfig = PARKS[parkId] ?? PARKS.yosemite;
  const seasonContent = parkSeasons[parkId] ?? parkSeasons.yosemite;
  const hero = parkHeroes[parkId] ?? parkHeroes.yosemite;
  const data = useMemo(() => seasonContent[activeSeason], [seasonContent, activeSeason]);

  const daysUntilTrip = useMemo(() => {
    if (!arrivalDate) return null;
    return differenceInDays(arrivalDate, new Date());
  }, [arrivalDate]);

  const mochiEncouragement = useMemo(() => {
    if (daysUntilTrip === null) return "";
    if (daysUntilTrip < 0) return "Your trip has started — have an amazing time! 🏔️";
    if (daysUntilTrip === 0) return "TODAY IS THE DAY! 🎉 Don't forget your permit!";
    if (daysUntilTrip < 7) return "Getting close! Double-check your permit watches.";
    if (daysUntilTrip <= 30) return "Almost there — keep those watches active!";
    return "Plenty of time to prep — keep those watches active!";
  }, [daysUntilTrip]);

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

  const timeGreeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto">
      {/* ── Top bar: park selector + actions ── */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
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

      {/* ── Hero Headline: "Go before X" ── */}
      <div className="px-5 mt-3 mb-1">
        {headlineData ? (
          <div>
            <h1 className="font-heading font-black text-[40px] text-foreground leading-[1.05] tracking-tight">
              Go before{" "}
              <span className="text-primary">{headlineData.quietEnd}</span>
            </h1>
            <p className="text-[12px] text-muted-foreground/85 mt-1.5 font-body">
              {headlineData.location} · {parkConfig.shortName}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="font-heading font-bold text-[26px] text-foreground leading-tight tracking-tight">
              {displayName ? `Hey ${displayName}` : "Welcome back"} — plan your visit.
            </h1>
          </div>
        )}
      </div>

      {/* ── Decision Hero Card ── */}
      <div className="px-5 mt-3">
        <DecisionHeroCard headlineData={headlineData} />
      </div>

      {/* ── Season Tabs ── */}
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

      {/* ── Trip Countdown — demoted below planning info ── */}
      <div className="px-5 mt-4">
        {arrivalDate && daysUntilTrip !== null ? (
          <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-lg px-3.5 py-2.5">
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
                className="w-full flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3.5 py-2.5 hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground font-body">Set arrival date</span>
                </div>
                <span className="text-[11px] text-primary font-semibold">Set date</span>
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

      {/* ── Dynamic seasonal content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${parkId}-${activeSeason}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Crowd Windows — swipeable carousel */}
          <div className="mt-4">
            <CrowdWindows parkId={parkId} season={activeSeason} onHeadlineData={setHeadlineData} />
          </div>

          {/* Crowd Pulse + Report */}
          <div className="px-5 mb-5 space-y-6">
            <CrowdPulse parkId={parkId} />
            <div className="border-t border-border pt-5">
              <CrowdReportForm parkId={parkId} />
            </div>
          </div>

          {/* Hero Image — moved below planning info */}
          <div className="px-5 mb-4">
            <div className="relative rounded-lg overflow-hidden h-40 shadow-lg">
              <img src={hero.image} alt={hero.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">{hero.badge}</span>
                <h2 className="font-heading text-base font-bold text-white mt-1.5 leading-snug">{hero.title}</h2>
              </div>
            </div>
          </div>

          {/* Mochi's seasonal tip — moved lower so it doesn't compete with planning */}
          <div className="px-5 mb-4">
            <div className="bg-secondary/8 border border-secondary/15 rounded-lg p-3.5 flex items-start gap-3">
              <AlertTriangle size={14} className="text-secondary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold text-secondary uppercase tracking-[0.1em]">
                    {activeSeason} · 🐻 Mochi Tip
                  </span>
                </div>
                <h3 className="font-semibold text-[12px] text-foreground leading-tight">{data.mochiTip.title}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{data.mochiTip.body}</p>
              </div>
            </div>
          </div>

          {/* Ranger Tips — compact cards */}
          <div className="px-5 mt-2 mb-2">
            <p className="section-header text-[11px]">Ranger Tips</p>
          </div>
          <div className="px-5 grid grid-cols-2 gap-2.5 pb-6">
            {data.tips.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <motion.div
                  key={tip.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-lg p-3"
                >
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-[12px] text-foreground leading-tight font-body">{tip.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed font-body line-clamp-3">{tip.body}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

export default DiscoverTips;
