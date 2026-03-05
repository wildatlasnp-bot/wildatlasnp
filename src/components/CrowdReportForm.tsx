import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Send, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PARKS } from "@/lib/parks";

interface CrowdReportFormProps {
  parkId: string;
}

const CROWD_LEVELS = ["Quiet", "Manageable", "Busy", "Packed"] as const;

const levelEmoji: Record<string, string> = {
  Quiet: "🟢",
  Manageable: "🟡",
  Busy: "🟠",
  Packed: "🔴",
};

// Common areas per park for quick selection
const PARK_AREAS: Record<string, string[]> = {
  yosemite: ["Yosemite Valley", "Glacier Point", "Tuolumne Meadows", "Mariposa Grove", "Mirror Lake"],
  zion: ["Angels Landing Trailhead", "The Narrows", "Zion Canyon Scenic Drive", "Emerald Pools", "Canyon Overlook"],
  glacier: ["Going-to-the-Sun Road", "Logan Pass", "Many Glacier", "Avalanche Lake", "Lake McDonald"],
  rainier: ["Paradise", "Sunrise", "Grove of the Patriarchs", "Skyline Trail", "Reflection Lakes"],
  rocky_mountain: ["Bear Lake", "Trail Ridge Road", "Emerald Lake", "Alberta Falls", "Dream Lake"],
  arches: ["Delicate Arch Trailhead", "Devils Garden", "Windows Section", "Landscape Arch", "Fiery Furnace"],
};

const CrowdReportForm = ({ parkId }: CrowdReportFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [areaName, setAreaName] = useState("");
  const [crowdLevel, setCrowdLevel] = useState<typeof CROWD_LEVELS[number] | null>(null);
  const [waitTime, setWaitTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const areas = useMemo(() => PARK_AREAS[parkId] ?? [], [parkId]);
  const parkName = PARKS[parkId]?.shortName ?? parkId;

  const generateFingerprint = useCallback((userId: string, park: string, area: string) => {
    // Simple fingerprint: user + park + area + 15-min window
    const window = Math.floor(Date.now() / (15 * 60 * 1000));
    return `${userId}:${park}:${area}:${window}`;
  }, []);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to report crowd conditions." });
      return;
    }
    if (!areaName.trim() || !crowdLevel) {
      toast({ title: "Missing info", description: "Please select an area and crowd level." });
      return;
    }

    setSubmitting(true);
    try {
      const fingerprint = generateFingerprint(user.id, parkId, areaName.trim());
      const { error } = await supabase.from("crowd_report_events" as any).insert({
        user_id: user.id,
        park_slug: parkId,
        area_name: areaName.trim(),
        crowd_level: crowdLevel,
        wait_time_minutes: waitTime ? parseInt(waitTime) : null,
        report_fingerprint: fingerprint,
      } as any);

      if (error) {
        if (error.message.includes("15 minutes") || error.message.includes("duplicate")) {
          toast({ title: "🐻 Easy there!", description: "You already reported this area recently. Try again in 15 minutes." });
        } else {
          toast({ title: "🐻 Couldn't submit", description: "Something went wrong. Try again!" });
          console.error("Crowd report error:", error.message);
        }
        return;
      }

      toast({ title: "✅ Report submitted!", description: `Thanks for reporting conditions at ${areaName}.` });
      setAreaName("");
      setCrowdLevel(null);
      setWaitTime("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={14} className="text-primary" />
        <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Report Conditions</span>
      </div>

      {/* Area selection */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {areas.map((area) => (
          <button
            key={area}
            onClick={() => setAreaName(area)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
              areaName === area
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Crowd level */}
      <div className="flex gap-1.5 mb-3">
        {CROWD_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setCrowdLevel(level)}
            className={`flex-1 text-[10px] font-semibold py-2 rounded-lg border transition-all ${
              crowdLevel === level
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            <span className="block text-sm mb-0.5">{levelEmoji[level]}</span>
            {level}
          </button>
        ))}
      </div>

      {/* Optional wait time */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          min={0}
          max={300}
          placeholder="Wait time (min, optional)"
          value={waitTime}
          onChange={(e) => setWaitTime(e.target.value)}
          className="flex-1 text-[11px] px-3 py-2 rounded-lg bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !areaName || !crowdLevel}
          className="gap-1.5 text-[11px]"
        >
          <Send size={12} />
          Submit
        </Button>
      </div>
    </motion.div>
  );
};

export default CrowdReportForm;
