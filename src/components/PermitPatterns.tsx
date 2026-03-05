import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Clock, Calendar, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface PermitPatternsProps {
  parkId: string;
  permitType?: string;
}

interface InsightData {
  total_detections: number;
  confidence: "High" | "Medium" | "Low";
  best_hour_local: number | null;
  peak_hours: number[];
  peak_days: number[];
  avg_alert_latency_seconds: number | null;
  alert_success_rate: number | null;
  period: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const confidenceColor: Record<string, string> = {
  High: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
};

const formatHour = (h: number) => {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const PermitPatterns = ({ parkId, permitType }: PermitPatternsProps) => {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!permitType) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_permit_insights", {
        p_park_slug: parkId,
        p_permit_type: permitType,
      });
      if (!error && data) {
        setInsights(data as unknown as InsightData);
      }
      setLoading(false);
    };
    load();
  }, [parkId, permitType]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-3 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (!insights || insights.total_detections === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Patterns</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Not enough data yet. Patterns will appear as the scanner detects more permits.
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
          <BarChart3 size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Patterns</span>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${confidenceColor[insights.confidence]}`}>
          {insights.confidence} confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {insights.best_hour_local != null && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-2">
            <Clock size={12} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Best Window</p>
              <p className="text-[11px] text-foreground font-medium">{formatHour(insights.best_hour_local)} <span className="text-[9px] text-muted-foreground font-normal">local time</span></p>
            </div>
          </div>
        )}

        {insights.peak_days.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-secondary/5 border border-secondary/10 px-2.5 py-2">
            <Calendar size={12} className="text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Peak Days</p>
              <p className="text-[11px] text-foreground font-medium">
                {insights.peak_days.map((d) => DAY_NAMES[d]).join(", ")}
              </p>
            </div>
          </div>
        )}

        {insights.peak_hours.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 px-2.5 py-2">
            <TrendingUp size={12} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Peak Hours</p>
              <p className="text-[11px] text-foreground font-medium">
                {insights.peak_hours.map(formatHour).join(", ")} <span className="text-[9px] text-muted-foreground font-normal">local time</span>
              </p>
            </div>
          </div>
        )}

        {insights.avg_alert_latency_seconds != null && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-2">
            <Clock size={12} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Alert Speed</p>
              <p className="text-[11px] text-foreground font-medium">
                {insights.avg_alert_latency_seconds < 60
                  ? `${Math.round(insights.avg_alert_latency_seconds)}s`
                  : `${Math.round(insights.avg_alert_latency_seconds / 60)}m`}
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/60 mt-2.5">
        Based on {insights.total_detections} detections in the last 30 days
      </p>
    </motion.div>
  );
};

export default PermitPatterns;
