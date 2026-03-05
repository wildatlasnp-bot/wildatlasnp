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
  High: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
};

const crowdLevelColor: Record<string, string> = {
  Quiet: "text-emerald-600 dark:text-emerald-400",
  Manageable: "text-amber-600 dark:text-amber-400",
  Busy: "text-orange-600 dark:text-orange-400",
  Packed: "text-red-600 dark:text-red-400",
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
      <div className="bg-card border border-border rounded-xl p-5 animate-pulse" style={{ boxShadow: "var(--card-shadow)" }}>
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-3 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (!insights || insights.total_reports === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Crowd Pulse</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No crowd reports yet. Be the first to report conditions below!
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Crowd Pulse</span>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${confidenceColor[insights.confidence]}`}>
          {insights.confidence} confidence
        </span>
      </div>

      {/* Top areas */}
      {insights.top_areas.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {insights.top_areas.map((area, i) => (
            <div key={area.area} className="flex items-center justify-between rounded-lg bg-muted/30 border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <MapPin size={11} className="text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">{crowdLevelEmoji[area.crowd_level] ?? "⚪"}</span>
                <span className={`text-[10px] font-semibold ${crowdLevelColor[area.crowd_level] ?? "text-muted-foreground"}`}>
                  {area.crowd_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Peak hours */}
      {insights.peak_hours.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 px-2.5 py-2">
          <Clock size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Peak Busy Hours</p>
            <p className="text-[11px] text-foreground font-medium">
              {insights.peak_hours.map(formatHour).join(", ")}
            </p>
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/60 mt-2.5">
        Based on {insights.total_reports} reports in the last 30 days
      </p>
    </motion.div>
  );
};

export default CrowdPulse;
