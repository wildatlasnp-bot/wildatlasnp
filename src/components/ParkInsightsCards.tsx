import { Users, Mountain, Ticket, Sunrise, Car, Snowflake, Camera } from "lucide-react";
import { motion } from "framer-motion";

interface InsightCard {
  icon: React.ReactNode;
  label: string;
  text: string;
}

const ParkInsightsCards = ({ parkId }: { parkId: string }) => {
  const insights: Record<string, InsightCard[]> = {
    yosemite: [
      { icon: <Users size={14} strokeWidth={1.5} />, label: "Crowd Insight", text: "Yosemite Valley crowds build after 10 AM." },
      { icon: <Mountain size={14} strokeWidth={1.5} />, label: "Trail Conditions", text: "Trails above 7,000 ft may still have snow patches." },
      { icon: <Ticket size={14} strokeWidth={1.5} />, label: "Permit Tip", text: "Half Dome cancellations often appear early morning." },
    ],
    rainier: [
      { icon: <Users size={14} strokeWidth={1.5} />, label: "Crowd Insight", text: "Paradise lot fills by 10 AM on weekends." },
      { icon: <Mountain size={14} strokeWidth={1.5} />, label: "Trail Conditions", text: "Skyline Trail has icy sections above 6,500 ft." },
      { icon: <Ticket size={14} strokeWidth={1.5} />, label: "Permit Tip", text: "Wonderland Trail walk-ups release at 1 PM daily." },
    ],
    grand_canyon: [
      { icon: <Users size={14} strokeWidth={1.5} />, label: "Crowd Insight", text: "South Rim crowds peak 9 AM–3 PM. Arrive early or visit Desert View instead." },
      { icon: <Mountain size={14} strokeWidth={1.5} />, label: "Trail Conditions", text: "Bright Angel upper sections icy Dec–Feb. Inner canyon exceeds 105°F in summer." },
      { icon: <Ticket size={14} strokeWidth={1.5} />, label: "Permit Tip", text: "Bright Angel overnight permits sell out fast — check recreation.gov for cancellations." },
    ],
    grand_teton: [
      { icon: <Users size={14} strokeWidth={1.5} />, label: "Crowd Insight", text: "Jenny Lake lot fills by 8 AM on summer weekends. String Lake is the best backup." },
      { icon: <Mountain size={14} strokeWidth={1.5} />, label: "Trail Conditions", text: "Cascade Canyon snow-free by mid-July. Teton Crest passable July–September only." },
      { icon: <Ticket size={14} strokeWidth={1.5} />, label: "Permit Tip", text: "Backcountry permits open January 5 — set an alert on WildAtlas." },
    ],
    zion: [
      { icon: <Users size={14} strokeWidth={1.5} />, label: "Crowd Insight", text: "Narrows entry is busiest 10 AM–2 PM. Start before 8 AM to beat the crowds." },
      { icon: <Mountain size={14} strokeWidth={1.5} />, label: "Trail Conditions", text: "Narrows can flood with little warning — check water flow at the visitor center." },
      { icon: <Ticket size={14} strokeWidth={1.5} />, label: "Permit Tip", text: "Angels Landing permits required year-round — lottery opens 3 days before and 7 days prior." },
    ],
    glacier: [
      { icon: <Sunrise size={14} strokeWidth={1.5} />, label: "Best Viewpoint", text: "Many Glacier valley at dawn for reflections of Grinnell." },
      { icon: <Car size={14} strokeWidth={1.5} />, label: "Parking Tip", text: "Many Glacier lot fills by 7 AM in summer — arrive before 6:30." },
      { icon: <Snowflake size={14} strokeWidth={1.5} />, label: "Season Note", text: "Going-to-the-Sun Road fully opens mid-June, closes mid-October." },
      { icon: <Camera size={14} strokeWidth={1.5} />, label: "Hidden Gem", text: "Iceberg Lake trail sees far fewer crowds than Grinnell Glacier." },
    ],
    rocky_mountain: [
      { icon: <Sunrise size={14} strokeWidth={1.5} />, label: "Best Viewpoint", text: "Bear Lake at sunrise before the crowds arrive after 8 AM." },
      { icon: <Car size={14} strokeWidth={1.5} />, label: "Parking Tip", text: "Bear Lake corridor requires timed entry permits May–October." },
      { icon: <Snowflake size={14} strokeWidth={1.5} />, label: "Season Note", text: "Trail Ridge Road opens late May, closes mid-October." },
      { icon: <Camera size={14} strokeWidth={1.5} />, label: "Hidden Gem", text: "Lily Lake loop is flat, scenic, and almost always uncrowded." },
    ],
    arches: [
      { icon: <Sunrise size={14} strokeWidth={1.5} />, label: "Best Viewpoint", text: "Delicate Arch at sunset — hike in by 4 PM for a good spot." },
      { icon: <Car size={14} strokeWidth={1.5} />, label: "Parking Tip", text: "Timed entry required 7 AM–4 PM April through October." },
      { icon: <Snowflake size={14} strokeWidth={1.5} />, label: "Season Note", text: "Summer temps exceed 100°F — spring and fall are ideal." },
      { icon: <Camera size={14} strokeWidth={1.5} />, label: "Hidden Gem", text: "Tower of Babel area in the Windows section is rarely visited." },
    ],
  };

  const cards = insights[parkId] ?? insights.yosemite;

  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        Today's Park Insights
      </p>
      <div className="flex flex-col gap-2">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 bg-card border border-border rounded-lg px-3.5 py-2.5"
          >
            <div className="shrink-0 mt-0.5 w-7 h-7 rounded-md bg-secondary/10 flex items-center justify-center text-secondary">
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-secondary uppercase tracking-wider leading-none mb-1">
                {card.label}
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                {card.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ParkInsightsCards;
