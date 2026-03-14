import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const crowdRowBg: Record<string, string> = {
  Quiet: "bg-status-quiet/[0.06]",
  Manageable: "bg-status-building/[0.06]",
  Busy: "bg-status-busy/[0.06]",
  Packed: "bg-status-peak/[0.06]",
};

const insightsCache = new Map<string, CrowdInsightData>();

const CrowdPulse = React.memo(({ parkId }: CrowdPulseProps) => {
  const [insights, setInsights] = useState<CrowdInsightData | null>(() => insightsCache.get(parkId) ?? null);
  const [hasLoaded, setHasLoaded] = useState(() => insightsCache.has(parkId));

  useEffect(() => {
    if (insightsCache.has(parkId)) {
      setInsights(insightsCache.get(parkId) ?? null);
      setHasLoaded(true);
      return;
    }
    const load = async () => {
      const { data, error } = await supabase.rpc("get_crowd_insights", {
        p_park_slug: parkId,
      });
      if (!error && data) {
        const result = data as unknown as CrowdInsightData;
        insightsCache.set(parkId, result);
        setInsights(result);
      }
      setHasLoaded(true);
    };
    load();
  }, [parkId]);

  if (!hasLoaded && !insights) {
    return (
      <div className="space-y-2" style={{ minHeight: 80 }}>
        <div className="h-11 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-11 bg-muted/30 rounded-xl animate-pulse" />
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
    <div>
      {insights.top_areas.length > 0 && (
        <div className="space-y-2">
          {insights.top_areas.map((area) => (
            <div
              key={area.area}
              className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${crowdRowBg[area.crowd_level] ?? "bg-muted/20"}`}
            >
              <span className="text-[13px] font-semibold text-foreground">{area.area}</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${crowdDotColor[area.crowd_level] ?? "bg-muted"}`} />
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
    </div>
  );
});

CrowdPulse.displayName = "CrowdPulse";

export default CrowdPulse;
