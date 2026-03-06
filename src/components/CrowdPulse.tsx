import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";
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

const crowdDotColor: Record<string, string> = {
  Quiet: "bg-status-quiet",
  Manageable: "bg-status-building",
  Busy: "bg-status-busy",
  Packed: "bg-status-peak",
};

const crowdLabelColor: Record<string, string> = {
  Quiet: "text-status-quiet",
  Manageable: "text-status-building",
  Busy: "text-status-busy",
  Packed: "text-status-peak",
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
      <div className="animate-pulse space-y-2.5">
        <div className="h-4 w-36 bg-muted rounded" />
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-10 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!insights || insights.total_reports === 0) {
    return (
      <div>
        <p className="text-[12px] text-muted-foreground font-body leading-[1.6]">
          No crowd reports yet. Submit one below to help fellow visitors!
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Area list */}
      {insights.top_areas.length > 0 && (
        <div className="space-y-1.5">
          {insights.top_areas.map((area) => (
            <div
              key={area.area}
              className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/70 px-4 py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <MapPin size={12} className="text-muted-foreground/50 shrink-0" />
                <span className="text-[13px] font-semibold text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${crowdDotColor[area.crowd_level] ?? "bg-muted"}`} />
                <span className={`text-[13px] font-bold ${crowdLabelColor[area.crowd_level] ?? "text-muted-foreground"}`}>
                  {area.crowd_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/60 mt-2.5">
        Based on {insights.total_reports} reports · last 30 days
      </p>
    </motion.div>
  );
};
