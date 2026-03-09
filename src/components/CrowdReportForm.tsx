import React, React, { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PARKS } from "@/lib/parks";

interface CrowdReportFormProps {
  parkId: string;
}

const CROWD_LEVELS = ["Quiet", "Manageable", "Busy", "Packed"] as const;

const levelDotColor: Record<string, string> = {
  Quiet: "bg-status-quiet",
  Manageable: "bg-status-building",
  Busy: "bg-status-busy",
  Packed: "bg-status-peak",
};

const levelActiveStyle: Record<string, string> = {
  Quiet: "bg-status-quiet/15 text-status-quiet border-status-quiet/40 ring-1 ring-status-quiet/20",
  Manageable: "bg-status-building/15 text-status-building border-status-building/40 ring-1 ring-status-building/20",
  Busy: "bg-status-busy/15 text-status-busy border-status-busy/40 ring-1 ring-status-busy/20",
  Packed: "bg-status-peak/15 text-status-peak border-status-peak/40 ring-1 ring-status-peak/20",
};

const PARK_AREAS: Record<string, string[]> = {
  yosemite: ["Yosemite Valley", "Glacier Point", "Tuolumne Meadows", "Mariposa Grove", "Mirror Lake"],
  zion: ["Angels Landing Trailhead", "The Narrows", "Zion Canyon Scenic Drive", "Emerald Pools", "Canyon Overlook"],
  glacier: ["Going-to-the-Sun Road", "Logan Pass", "Many Glacier", "Avalanche Lake", "Lake McDonald"],
  rainier: ["Paradise", "Sunrise", "Grove of the Patriarchs", "Skyline Trail", "Reflection Lakes"],
  rocky_mountain: ["Bear Lake", "Trail Ridge Road", "Emerald Lake", "Alberta Falls", "Dream Lake"],
  arches: ["Delicate Arch Trailhead", "Devils Garden", "Windows Section", "Landscape Arch", "Fiery Furnace"],
};

const CrowdReportReact.memo(Form = ({ parkId }: CrowdReportFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [areaName, setAreaName] = useState("");
  const [crowdLevel, setCrowdLevel] = useState<typeof CROWD_LEVELS[number] | null>(null);
  const [waitTime, setWaitTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const areas = useMemo(() => PARK_AREAS[parkId] ?? [], [parkId]);
  const parkName = PARKS[parkId]?.shortName ?? parkId;

  const generateFingerprint = useCallback((userId: string, park: string, area: string) => {
    const window = Math.floor(Date.now() / (15 * 60 * 1000));
    return `${userId}:${park}:${area}:${window}`;
  }, []);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to report crowd conditions." });
      return;
    }
    if (!areaName.trim() || !crowdLevel) {
      toast({ title: "Missing info", description: "Select a location and crowd level." });
      return;
    }

    setSubmitting(true);
    try {
      const fingerprint = generateFingerprint(user.id, parkId, areaName.trim());
      const { error } = await supabase.from("crowd_report_events").insert({
        user_id: user.id,
        park_slug: parkId,
        area_name: areaName.trim(),
        crowd_level: crowdLevel,
        wait_time_minutes: waitTime ? parseInt(waitTime) : null,
        report_fingerprint: fingerprint,
      });

      if (error) {
        if (error.message.includes("15 minutes") || error.message.includes("duplicate")) {
          toast({ title: "🐻 Easy there!", description: "You already reported this area recently. Try again in 15 minutes." });
        } else {
          toast({ title: "🐻 Couldn't submit", description: "Something went wrong. Try again!" });
          console.error("Crowd report error:", error.message);
        }
        return;
      }

      toast({ title: "✅ Report submitted!", description: `Thanks for reporting ${areaName}.` });
      setAreaName("");
      setCrowdLevel(null);
      setWaitTime("");
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = areaName.trim() && crowdLevel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[18px] border border-border/70 bg-card p-5"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-4">
        Report Conditions
      </p>

      {/* Step 1: Location */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        1 · Location
      </p>
      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {areas.map((area) => (
            <button
              key={area}
              onClick={() => setAreaName(area)}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-all ${
                areaName === area
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-5">
          <input
            type="text"
            placeholder={`Area name in ${parkName}`}
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            className="w-full text-[12px] px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Step 2: Status */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        2 · How crowded?
      </p>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {CROWD_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setCrowdLevel(level)}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
              crowdLevel === level
                ? levelActiveStyle[level]
                : "bg-muted/20 text-muted-foreground border-border/60 hover:border-primary/30"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${levelDotColor[level]}`} />
            <span className="text-[10px] font-bold">{level}</span>
          </button>
        ))}
      </div>

      {/* Optional wait time */}
      <div>
        <input
          type="number"
          min={0}
          max={300}
          placeholder="Wait time at trailhead (minutes)"
          value={waitTime}
          onChange={(e) => setWaitTime(e.target.value)}
          className="w-full text-[11px] px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1 ml-0.5 font-medium">Optional — helps other hikers plan their visit.</p>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !isReady}
          className="flex-1 gap-1.5 text-[12px] font-bold active:scale-[0.98] transition-transform"
        >
          <Send size={13} />
          Submit Report
        </Button>
      </div>
    </motion.div>
  );
};

export default CrowdReportForm;
