import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface CrowdPulseProps {
  parkId: string;
}

interface CrowdInsightData {
  total_reports: number;
  confidence: "High" | "Medium" | "Low";
  top_areas: Array<{ area: string; reports: number; crowd_level: string }>;
  peak_hours: number[];
  period: string;
}

const confidenceColor: Record<string, string> = {
  High: "bg-status-quiet/15 text-status-quiet-foreground",
  Medium: "bg-status-building/15 text-status-building-foreground",
  Low: "bg-muted text-muted-foreground",
};

const crowdLevelColor: Record<string, string> = {
  Quiet: "text-status-quiet",
  Manageable: "text-status-building",
  Busy: "text-status-busy",
  Packed: "text-status-peak",
};

const crowdLevelEmoji: Record<string, string> = {
  Quiet: "🟢",
  Manageable: "🟡",
  Busy: "🟠",
  Packed: "🔴",
};

const formatHour = (h: number) => {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const CrowdPulse = ({ parkId }: CrowdPulseProps) => {
  const [insights, setInsights] = useState<CrowdInsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_crowd_insights", {
        p_park_slug: parkId,
      });
      if (!error && data) {
        setInsights(data as unknown as CrowdInsightData);
      }
      setLoading(false);
    };
    load();
  }, [parkId]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-3 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (!insights || insights.total_reports === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity size={13} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.1em] font-body">Crowd Pulse</span>
        </div>
        <p className="text-[12px] text-muted-foreground font-body leading-[1.6]">
          No crowd data yet for this park. Scroll down to submit a report and help fellow visitors!
        </p>
        <p className="text-[10px] text-muted-foreground/60 font-body mt-1.5 leading-[1.5]">
          Once enough reports come in, you'll see busy areas, peak hours, and confidence levels here.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.1em]">Crowd Pulse</span>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${confidenceColor[insights.confidence]}`}>
          {insights.confidence} confidence
        </span>
      </div>

      {/* Top areas */}
      {insights.top_areas.length > 0 && (
        <div className="space-y-2 mb-4">
          {insights.top_areas.map((area, i) => (
            <div key={area.area} className="flex items-center justify-between rounded-lg bg-muted/30 border border-border px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <MapPin size={11} className="text-muted-foreground/60 shrink-0" />
                <span className="text-[12px] font-semibold text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]">{crowdLevelEmoji[area.crowd_level] ?? "⚪"}</span>
                <span className={`text-[12px] font-bold ${crowdLevelColor[area.crowd_level] ?? "text-muted-foreground"}`}>
                  {area.crowd_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-2.5">
        Based on {insights.total_reports} reports in the last 30 days
      </p>
    </motion.div>
  );
};

export default CrowdPulse;
