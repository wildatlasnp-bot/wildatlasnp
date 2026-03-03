import { Flame, Droplets, Mountain, Camera, LogOut, Share } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
  { id: 4, icon: Camera, title: "Golden Hour", body: "Tunnel View at sunset is unbeatable. Arrive 30 min early for a spot." },
];

const SHARE_TEXT = "Check out Pathfinder—it's an AI agent that snipes Yosemite permit cancellations and tracks parking in real-time. Join the waitlist here: https://id-preview--c8c0510e-d862-4c27-a4cd-d791669ee24c.lovable.app";

const DiscoverTips = () => {
  const { displayName, signOut } = useAuth();
  const { toast } = useToast();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pathfinder Agent", text: SHARE_TEXT });
      } catch (e) {
        // User cancelled — no action needed
      }
    } else {
      await navigator.clipboard.writeText(SHARE_TEXT);
      toast({ title: "Link copied!", description: "Share message copied to clipboard." });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero greeting */}
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-secondary tracking-widest uppercase mb-1">Good morning</p>
          <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">
            Welcome back{displayName ? `, ${displayName}` : ", Ranger"}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ready to beat the Yosemite crowds?</p>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            aria-label="Share Pathfinder"
          >
            <Share size={18} />
          </button>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Hero image card */}
      <div className="px-5 mt-4 mb-6">
        <div className="relative rounded-2xl overflow-hidden h-48 shadow-lg">
          <img src={yosemiteHero} alt="Yosemite Half Dome at golden hour" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">Featured</span>
            <h2 className="font-heading text-lg font-bold text-white mt-2 leading-snug">Half Dome at Golden Hour</h2>
          </div>
        </div>
      </div>

      {/* Section title */}
      <div className="px-5 mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ranger Tips</h2>
      </div>

      {/* Tips grid */}
      <div className="px-5 grid grid-cols-2 gap-3 pb-6">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/8 text-primary flex items-center justify-center mb-3">
                <Icon size={16} />
              </div>
              <h3 className="font-semibold text-[13px] text-foreground leading-tight">{tip.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{tip.body}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default DiscoverTips;
