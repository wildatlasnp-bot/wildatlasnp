import { useState, useMemo, useCallback, forwardRef } from "react";
import { Share, AlertTriangle, User, CalendarIcon } from "lucide-react";
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

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto">
      {/* Hero greeting — smaller, less dominant */}
      <div className="px-5 pt-4 pb-1 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase font-body">
              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}
            </p>
            <ParkSelector activeParkId={parkId} onParkChange={onParkChange ?? (() => {})} />
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground leading-tight">
            {displayName ? `Hey ${displayName}` : "Welcome back"}.
          </h1>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <a href="/settings" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Settings">
            <User size={18} />
          </a>
          <button onClick={handleShare} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="Share WildAtlas">
            <Share size={18} />
          </button>
        </div>
      </div>

      {/* Trip Countdown — flat section, no card wrapper */}
      <div className="px-5 mt-4">
        {arrivalDate && daysUntilTrip !== null ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-body mb-1">Trip Countdown</p>
              <h2 className="font-heading font-bold text-2xl text-primary leading-tight">
                {daysUntilTrip <= 0
                  ? daysUntilTrip === 0 ? "Today!" : "You're there!"
                  : `${daysUntilTrip} Day${daysUntilTrip !== 1 ? "s" : ""}`}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1 font-body">
                Arriving {format(arrivalDate, "MMMM d, yyyy")} · {parkConfig.shortName}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-body">
                🐻 {mochiEncouragement}
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 rounded-lg border-border">
                  <CalendarIcon size={16} />
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-body mb-1">Trip Countdown</p>
              <p className="text-[13px] font-medium text-foreground font-body">When are you heading to {parkConfig.shortName}?</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-body">🐻 Set your arrival date for a countdown</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="shrink-0 rounded-lg border-border gap-2 text-[12px]">
                  <CalendarIcon size={14} />
                  Pick Date
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
        )}
      </div>

      {/* Divider */}
      <div className="px-5 my-4"><div className="border-t border-border" /></div>

      {/* Season Tabs */}
      <div className="px-5 mt-3">
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {seasons.map((s) => {
            const SeasonIcon = seasonContent[s].icon;
            const isActive = s === activeSeason;
            return (
              <button
                key={s}
                onClick={() => setActiveSeason(s)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="season-pill"
                    className="absolute inset-0 bg-primary rounded-lg shadow-sm"
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

      {/* Dynamic Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${parkId}-${activeSeason}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Mochi's Tip */}
          <div className="px-5 mt-4">
            <div className="bg-secondary/15 border border-secondary/30 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {activeSeason}
                  </span>
                  <span className="text-[10px] text-muted-foreground">🐻 Mochi Tip</span>
                </div>
                <h3 className="font-semibold text-[13px] text-foreground leading-tight">{data.mochiTip.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{data.mochiTip.body}</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="px-5 mt-4 mb-4">
            <div className="relative rounded-2xl overflow-hidden h-48 shadow-lg">
              <img src={hero.image} alt={hero.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">{hero.badge}</span>
                <h2 className="font-heading text-lg font-bold text-white mt-2 leading-snug">{hero.title}</h2>
              </div>
            </div>
          </div>

          {/* Crowd Windows */}
          <CrowdWindows parkId={parkId} season={activeSeason} />

          {/* Crowd Pulse + Report */}
          <div className="px-5 mb-4 space-y-3">
            <CrowdPulse parkId={parkId} />
            <CrowdReportForm parkId={parkId} />
          </div>

          {/* Ranger Tips */}
          <div className="px-5 mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ranger Tips</h2>
          </div>
          <div className="px-5 grid grid-cols-2 gap-3 pb-6">
            {data.tips.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <motion.div
                  key={tip.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Icon size={16} />
                  </div>
                  <h3 className="font-semibold text-[13px] text-foreground leading-tight">{tip.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{tip.body}</p>
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
