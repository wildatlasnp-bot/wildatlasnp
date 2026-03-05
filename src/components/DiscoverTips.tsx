import { useState, useMemo, useCallback, forwardRef } from "react";
import {
  Flame, Droplets, Mountain, Camera, Share, AlertTriangle, User,
  Snowflake, Sun, Leaf, Flower2, Car, MapPin, TreePine, Hotel,
  CalendarIcon, Footprints, Wind, CloudRain, Tent, ThermometerSun
} from "lucide-react";
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
import yosemiteHero from "@/assets/yosemite-hero.jpg";
import rainierHero from "@/assets/rainier-hero.jpg";
import enchantmentsHero from "@/assets/enchantments-hero.jpg";
import whitneyHero from "@/assets/whitney-hero.jpg";
import zionHero from "@/assets/zion-hero.jpg";

type Season = "spring" | "summer" | "fall" | "winter";

interface Tip {
  id: number;
  icon: React.ElementType;
  title: string;
  body: string;
}

interface SeasonData {
  label: string;
  icon: React.ElementType;
  mochiTip: { title: string; body: string };
  tips: Tip[];
}

interface HeroConfig {
  image: string;
  alt: string;
  badge: string;
  title: string;
}

/* ── Park-specific content ── */

const yosemiteSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Waterfalls peak in May — Yosemite Falls and Bridalveil are thundering. Don't miss Firefall in February if you're early-season!" },
    tips: [
      { id: 1, icon: Droplets, title: "Waterfall Season", body: "Peak flow in May. Yosemite Falls drops 2,425 ft — the tallest in North America." },
      { id: 2, icon: Flame, title: "Firefall Window", body: "Mid-to-late February at Horsetail Fall. Arrive by 4 PM for a spot at El Capitan Picnic Area." },
      { id: 3, icon: Mountain, title: "Trail Conditions", body: "Upper trails may have snow patches through May. Check conditions before heading above 7,000 ft." },
      { id: 4, icon: Camera, title: "Wildflower Bloom", body: "Valley meadows bloom March–May. Sentinel Meadow and Cook's Meadow are prime spots." },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Valley lots fill by 8:30 AM.** Enter through the gate before 7:30 AM or take YARTS from Merced. Half Dome permits are required — lottery closed March 31." },
    tips: [
      { id: 1, icon: AlertTriangle, title: "8:30 AM Parking", body: "Valley lots full by 8:30 AM. Gate entry recommended before 7:30 AM." },
      { id: 2, icon: Mountain, title: "Half Dome Permits", body: "Daily lottery available at recreation.gov. Check 2 days before your planned hike." },
      { id: 3, icon: Flame, title: "Fire Safety", body: "Campfires only in designated fire rings. Always drown, stir, feel." },
      { id: 4, icon: Camera, title: "Golden Hour", body: "Tunnel View at sunset is unbeatable. Arrive 30 min early for a spot." },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "Crowds thin dramatically after Labor Day. Midweek visits mean near-empty trails and cozy lodges. Book the Ahwahnee now!" },
    tips: [
      { id: 1, icon: TreePine, title: "Quiet Trails", body: "Valley Loop Trail and Lower Yosemite Fall are peaceful midweek. Expect fewer than 50 hikers." },
      { id: 2, icon: Hotel, title: "Lodge Availability", body: "Fall has the best availability. Curry Village tents close mid-Oct, but cabins stay open." },
      { id: 3, icon: Mountain, title: "Last Chance Hikes", body: "Glacier Point Road closes in November. Hike Sentinel Dome before snow arrives." },
      { id: 4, icon: Leaf, title: "Wildlife Activity", body: "Bears are fattening for winter. Secure all food in bear lockers — it's the law." },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Snow chains are REQUIRED on Hwy 41 and 140 Nov–April. Tioga Road and Glacier Point Road are closed. The Valley is serene — and uncrowded." },
    tips: [
      { id: 1, icon: Car, title: "Chain Requirements", body: "R2 chain controls frequent. Carry chains fitted to your tires — practice installing before your trip." },
      { id: 2, icon: MapPin, title: "Tioga Road Closed", body: "Tioga Pass (Hwy 120) is closed Nov–May. Glacier Point Road closes similarly." },
      { id: 3, icon: Snowflake, title: "Snow Activities", body: "Badger Pass ski area opens December. Ranger-led snowshoe walks on weekends." },
      { id: 4, icon: Camera, title: "Winter Magic", body: "Snow-dusted El Capitan is breathtaking. Valley is nearly empty — perfect for photography." },
    ],
  },
};

const rainierSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Snow still blankets higher elevations through June. Paradise road may be closed weekdays — check WSDOT alerts before driving up." },
    tips: [
      { id: 1, icon: CloudRain, title: "Avalanche Season", body: "Backcountry avalanche risk remains high through May. Check NWAC forecasts before venturing above treeline." },
      { id: 2, icon: Flower2, title: "Early Wildflowers", body: "Lower elevation meadows around Longmire start blooming in May. Peak bloom at Paradise comes later in July." },
      { id: 3, icon: Car, title: "Road Openings", body: "Sunrise Road typically opens late June. Paradise Road is open year-round but may close for storms." },
      { id: 4, icon: Mountain, title: "Climbing Season Prep", body: "Summit attempts begin in May. Register at the climbing ranger station and carry a WAG bag." },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Wonderland Trail permits sell out in minutes.** Wilderness permits are required May 15–Oct 15. Camp Muir fills fast on clear weekends — start early." },
    tips: [
      { id: 1, icon: Footprints, title: "Wonderland Trail", body: "93 miles around the mountain. Permits released March 1 — set your alarm. Cancellations appear on Recreation.gov." },
      { id: 2, icon: Mountain, title: "Camp Muir", body: "10,080 ft base camp for summit attempts. Start from Paradise by 5 AM. Bring crampons and an ice axe." },
      { id: 3, icon: Tent, title: "Wilderness Camping", body: "138 backcountry camps. Popular sites like Indian Bar and Summerland book months ahead." },
      { id: 4, icon: ThermometerSun, title: "Paradise Crowds", body: "Paradise parking fills by 10 AM on weekends. Arrive before 8 AM or visit midweek." },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "September is Rainier's secret weapon — clear skies, thin crowds, and stunning larch trees turning gold at higher elevations. Last call for Wonderland!" },
    tips: [
      { id: 1, icon: Leaf, title: "Larch Season", body: "Subalpine larches turn brilliant gold in late September. Best viewed along the Naches Peak Loop trail." },
      { id: 2, icon: TreePine, title: "Quiet Backcountry", body: "Permit availability opens up dramatically after Labor Day. Great time for spontaneous Wonderland sections." },
      { id: 3, icon: Wind, title: "Weather Shifts", body: "Pacific storms arrive by October. Bring rain gear and check forecasts — conditions change fast above 6,000 ft." },
      { id: 4, icon: Camera, title: "Photo Season", body: "Clear fall mornings offer the best views of the summit. Reflection Lakes at sunrise is iconic." },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Paradise averages **640 inches of snow per year** — one of the snowiest places on Earth. Only the Nisqually entrance to Paradise is open. Tire chains required." },
    tips: [
      { id: 1, icon: Snowflake, title: "Epic Snowfall", body: "Paradise holds the world record for annual snowfall (1,122 inches in 1971–72). Snowshoeing and cross-country skiing are prime." },
      { id: 2, icon: Car, title: "Limited Access", body: "Only Nisqually–Paradise road is plowed. Sunrise, Carbon River, and Mowich are closed November–June." },
      { id: 3, icon: AlertTriangle, title: "Avalanche Danger", body: "Backcountry travel requires avalanche training and gear. Check NWAC daily before heading out." },
      { id: 4, icon: Mountain, title: "Winter Climbing", body: "Winter summit attempts are expert-only. Extreme cold, high winds, and whiteout conditions are common above 10,000 ft." },
    ],
  },
};

const parkSeasons: Record<string, Record<Season, SeasonData>> = {
  yosemite: yosemiteSeasons,
  rainier: rainierSeasons,
};

const parkHeroes: Record<string, HeroConfig> = {
  yosemite: { image: yosemiteHero, alt: "Yosemite Half Dome at golden hour", badge: "Featured", title: "Half Dome at Golden Hour" },
  rainier: { image: rainierHero, alt: "Mount Rainier above wildflower meadows", badge: "Featured", title: "Rainier from Paradise Meadows" },
  enchantments: { image: enchantmentsHero, alt: "Enchantments alpine lake with golden larches", badge: "Featured", title: "Colchuck Lake & Larches" },
  whitney: { image: whitneyHero, alt: "Mt. Whitney summit at sunrise", badge: "Featured", title: "Whitney Summit at Dawn" },
  zion: { image: zionHero, alt: "Zion Narrows slot canyon with Virgin River", badge: "Featured", title: "The Narrows at Golden Hour" },
};

const seasons: Season[] = ["spring", "summer", "fall", "winter"];

function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

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
  const seasonContent = parkSeasons[parkId] ?? yosemiteSeasons;
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
      {/* Hero greeting */}
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-medium text-secondary tracking-widest uppercase">
              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}
            </p>
            <ParkSelector activeParkId={parkId} onParkChange={onParkChange ?? (() => {})} />
          </div>
          <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">
            Welcome to your WildAtlas{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ready to beat the crowds?</p>
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

      {/* Trip Countdown Widget */}
      <div className="px-5 mt-3">
        <div className="bg-card border border-border rounded-xl p-4">
          {arrivalDate && daysUntilTrip !== null ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h2 className="font-heading font-bold text-2xl text-primary leading-tight">
                  {daysUntilTrip <= 0
                    ? daysUntilTrip === 0 ? "Today!" : "You're there!"
                    : `${daysUntilTrip} Day${daysUntilTrip !== 1 ? "s" : ""} Until ${parkConfig.shortName}`}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span>🐻</span>
                  <span>{mochiEncouragement}</span>
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                  Arriving {format(arrivalDate, "MMMM d, yyyy")}
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
                <h3 className="font-heading font-semibold text-[15px] text-foreground">When are you heading to {parkConfig.shortName}?</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">🐻 Set your arrival date for a personalized countdown</p>
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
      </div>

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
