import { Flame, Droplets, Mountain, Camera } from "lucide-react";
import { motion } from "framer-motion";
import yosemiteHero from "@/assets/yosemite-hero.jpg";

interface Tip {
  id: number;
  icon: React.ElementType;
  title: string;
  body: string;
}

const tips: Tip[] = [
  { id: 1, icon: Droplets, title: "Hydrate Early", body: "Carry at least 1L per 2 miles. Refill at Vernal Fall footbridge." },
  { id: 2, icon: Mountain, title: "Altitude Matters", body: "Yosemite Valley sits at 4,000 ft. Take it slow the first day." },
  { id: 3, icon: Flame, title: "Fire Safety", body: "Campfires allowed only in designated fire rings. Always drown, stir, feel." },
  { id: 4, icon: Camera, title: "Golden Hour Shots", body: "Tunnel View at sunset is unbeatable. Arrive 30 min early for a spot." },
];

const DiscoverTips = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Discover</h1>
        <p className="text-sm text-muted-foreground">Tips & insider knowledge</p>
      </div>

      {/* Hero card */}
      <div className="px-4 mb-5">
        <div className="relative rounded-2xl overflow-hidden h-44">
          <img
            src={yosemiteHero}
            alt="Yosemite Half Dome at golden hour"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
              Featured
            </span>
            <h2 className="font-heading text-lg font-bold text-white mt-1.5">
              Half Dome at Golden Hour
            </h2>
          </div>
        </div>
      </div>

      {/* Tips grid */}
      <div className="px-4 grid grid-cols-2 gap-3 pb-4">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2.5">
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{tip.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tip.body}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default DiscoverTips;
