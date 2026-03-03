import { useState, useMemo, useCallback } from "react";
import {
  Flame, Droplets, Mountain, Camera, LogOut, Share, AlertTriangle,
  Snowflake, Sun, Leaf, Flower2, Car, MapPin, TreePine, Hotel, Backpack,
  CheckSquare, Square, Footprints, Wind, Glasses, Wallet, Layers, Flashlight,
  Container, Link2, Radio
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import yosemiteHero from "@/assets/yosemite-hero.jpg";

type Season = "spring" | "summer" | "fall" | "winter";

interface Tip {
  id: number;
  icon: React.ElementType;
  title: string;
  body: string;
}

interface GearCheckItem {
  id: string;
  label: string;
  mochiReaction: string;
}

interface SeasonData {
  label: string;
  icon: React.ElementType;
  mochiTip: { title: string; body: string };
  gear: { icon: React.ElementType; title: string; body: string }[];
  checklist: GearCheckItem[];
  tips: Tip[];
}

const seasonData: Record<Season, SeasonData> = {
  spring: {
    label: "Spring",
    icon: Flower2,
    mochiTip: {
      title: "🐻 Mochi's Spring Tip",
      body: "Waterfalls peak in May — Yosemite Falls and Bridalveil are thundering. Don't miss Firefall in February if you're early-season!",
    },
    gear: [
      { icon: Droplets, title: "Rain Layers", body: "Waterproof shell + mid-layer. Afternoon showers are common through April." },
      { icon: Camera, title: "Waterfall Lens", body: "ND filter for silky waterfall shots. Mist guard recommended at Vernal Fall." },
    ],
    checklist: [
      { id: "sp1", label: "Waterproof Boots", mochiReaction: "Great choice! 🥾 Soggy trails are no joke in spring." },
      { id: "sp2", label: "Windbreaker", mochiReaction: "Smart! Valley winds pick up fast near the falls." },
      { id: "sp3", label: "Polarized Lens", mochiReaction: "Great choice! Glare off the waterfalls can be blinding." },
    ],
    tips: [
      { id: 1, icon: Droplets, title: "Waterfall Season", body: "Peak flow in May. Yosemite Falls drops 2,425 ft — the tallest in North America." },
      { id: 2, icon: Flame, title: "Firefall Window", body: "Mid-to-late February at Horsetail Fall. Arrive by 4 PM for a spot at El Capitan Picnic Area." },
      { id: 3, icon: Mountain, title: "Trail Conditions", body: "Upper trails may have snow patches through May. Check conditions before heading above 7,000 ft." },
      { id: 4, icon: Camera, title: "Wildflower Bloom", body: "Valley meadows bloom March–May. Sentinel Meadow and Cook's Meadow are prime spots." },
    ],
  },
  summer: {
    label: "Summer",
    icon: Sun,
    mochiTip: {
      title: "🐻 Mochi's Summer Warning",
      body: "**Valley lots fill by 8:30 AM.** Enter through the gate before 7:30 AM or take YARTS from Merced. Half Dome permits are required — lottery closed March 31.",
    },
    gear: [
      { icon: Droplets, title: "Hydration Pack", body: "Carry 3L minimum for full-day hikes. Refill at Vernal Fall footbridge." },
      { icon: Sun, title: "Sun Protection", body: "SPF 50+, wide-brim hat, UV sleeves. Elevation amplifies UV exposure." },
    ],
    checklist: [
      { id: "su1", label: "3L Water Reservoir", mochiReaction: "Safety first! 💧 Dehydration is the #1 trail emergency." },
      { id: "su2", label: "Sunscreen (SPF 50+)", mochiReaction: "Great choice! UV is 25% stronger at elevation." },
      { id: "su3", label: "Digital Permit Wallet", mochiReaction: "Smart! Rangers check permits on the cables." },
    ],
    tips: [
      { id: 1, icon: AlertTriangle, title: "8:30 AM Parking", body: "Valley lots full by 8:30 AM. Gate entry recommended before 7:30 AM." },
      { id: 2, icon: Mountain, title: "Half Dome Permits", body: "Daily lottery available at recreation.gov. Check 2 days before your planned hike." },
      { id: 3, icon: Flame, title: "Fire Safety", body: "Campfires only in designated fire rings. Always drown, stir, feel." },
      { id: 4, icon: Camera, title: "Golden Hour", body: "Tunnel View at sunset is unbeatable. Arrive 30 min early for a spot." },
    ],
  },
  fall: {
    label: "Fall",
    icon: Leaf,
    mochiTip: {
      title: "🐻 Mochi's Fall Tip",
      body: "Crowds thin dramatically after Labor Day. Midweek visits mean near-empty trails and cozy lodges. Book the Ahwahnee now!",
    },
    gear: [
      { icon: Backpack, title: "Layering System", body: "Mornings can be 35°F, afternoons 70°F. Pack a fleece + wind shell." },
      { icon: Camera, title: "Fall Colors", body: "Black oaks turn gold in late October. Best spots: Yosemite Village and Sentinel Bridge." },
    ],
    checklist: [
      { id: "fa1", label: "Merino Layers", mochiReaction: "Great choice! Merino regulates temp from 35°F mornings to 70°F afternoons." },
      { id: "fa2", label: "Headlamp", mochiReaction: "Safety first! 🔦 Days are shorter — sunset hits by 5:30 PM." },
      { id: "fa3", label: "Bear Canister", mochiReaction: "Safety first! Bears are extra active before hibernation." },
    ],
    tips: [
      { id: 1, icon: TreePine, title: "Quiet Trails", body: "Valley Loop Trail and Lower Yosemite Fall are peaceful midweek. Expect fewer than 50 hikers." },
      { id: 2, icon: Hotel, title: "Lodge Availability", body: "Fall has the best availability. Curry Village tents close mid-Oct, but cabins stay open." },
      { id: 3, icon: Mountain, title: "Last Chance Hikes", body: "Glacier Point Road closes in November. Hike Sentinel Dome before snow arrives." },
      { id: 4, icon: Leaf, title: "Wildlife Activity", body: "Bears are fattening for winter. Secure all food in bear lockers — it's the law." },
    ],
  },
  winter: {
    label: "Winter",
    icon: Snowflake,
    mochiTip: {
      title: "🐻 Mochi's Winter Alert",
      body: "Snow chains are REQUIRED on Hwy 41 and 140 Nov–April. Tioga Road and Glacier Point Road are closed. The Valley is serene — and uncrowded.",
    },
    gear: [
      { icon: Car, title: "Snow Chains", body: "Required Nov–Apr on Hwy 41 & 140. Carry chains even with AWD — CHP enforces at checkpoints." },
      { icon: Snowflake, title: "Winter Layers", body: "Insulated boots, waterproof pants, hand warmers. Valley temps drop to 20°F overnight." },
    ],
    checklist: [
      { id: "wi1", label: "Snow Chains (Required)", mochiReaction: "Safety first! ⛓️ CHP will turn you back without them." },
      { id: "wi2", label: "Micro-spikes", mochiReaction: "Great choice! Ice on Valley trails is sneaky in January." },
      { id: "wi3", label: "Emergency Satellite Device", mochiReaction: "Safety first! 📡 No cell service in most of the park." },
    ],
    tips: [
      { id: 1, icon: Car, title: "Chain Requirements", body: "R2 chain controls frequent. Carry chains fitted to your tires — practice installing before your trip." },
      { id: 2, icon: MapPin, title: "Tioga Road Closed", body: "Tioga Pass (Hwy 120) is closed Nov–May. Glacier Point Road closes similarly." },
      { id: 3, icon: Snowflake, title: "Snow Activities", body: "Badger Pass ski area opens December. Ranger-led snowshoe walks on weekends." },
      { id: 4, icon: Camera, title: "Winter Magic", body: "Snow-dusted El Capitan is breathtaking. Valley is nearly empty — perfect for photography." },
    ],
  },
};

const seasons: Season[] = ["spring", "summer", "fall", "winter"];

function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

const SHARE_TITLE = "WildAtlas - Yosemite Permit Sniper";
const SHARE_TEXT = "Check out WildAtlas—I'm using it to track 2026 Yosemite parking and catch Half Dome permit cancellations. Join the waitlist here:";
const SHARE_URL = "https://wildatlas.lovable.app";

const DiscoverTips = () => {
  const { displayName, signOut } = useAuth();
  const { toast } = useToast();
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const data = useMemo(() => seasonData[activeSeason], [activeSeason]);

  const handleCheck = useCallback((item: GearCheckItem) => {
    setCheckedItems((prev) => {
      const wasChecked = prev[item.id];
      if (!wasChecked) {
        toast({
          title: `🐻 ${item.mochiReaction}`,
          description: `${item.label} — checked off your list.`,
        });
      }
      return { ...prev, [item.id]: !wasChecked };
    });
  }, [toast]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero greeting */}
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-secondary tracking-widest uppercase mb-1">Good morning</p>
          <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">
            Welcome to your WildAtlas{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ready to beat the Yosemite crowds?</p>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <button onClick={handleShare} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="Share WildAtlas">
            <Share size={18} />
          </button>
          <button onClick={signOut} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Seasonal Toggle */}
      <div className="px-5 mt-3">
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {seasons.map((s) => {
            const SeasonIcon = seasonData[s].icon;
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
                  {seasonData[s].label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSeason}
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
              <img src={yosemiteHero} alt="Yosemite Half Dome at golden hour" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">Featured</span>
                <h2 className="font-heading text-lg font-bold text-white mt-2 leading-snug">Half Dome at Golden Hour</h2>
              </div>
            </div>
          </div>

          {/* Essential Gear */}
          <div className="px-5 mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Essential Gear</h2>
          </div>
          <div className="px-5 flex gap-3 mb-5">
            {data.gear.map((item, i) => {
              const GearIcon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex-1 bg-card border border-border rounded-xl p-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <GearIcon size={16} />
                  </div>
                  <h3 className="font-semibold text-[13px] text-foreground leading-tight">{item.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{item.body}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Gear Checklist */}
          <div className="px-5 mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Gear Checklist</h2>
          </div>
          <div className="px-5 mb-5">
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {data.checklist.map((item, i) => (
                <motion.label
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <Checkbox
                    checked={!!checkedItems[item.id]}
                    onCheckedChange={() => handleCheck(item)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className={`text-[13px] font-medium transition-all ${checkedItems[item.id] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.label}
                  </span>
                </motion.label>
              ))}
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
};

export default DiscoverTips;
