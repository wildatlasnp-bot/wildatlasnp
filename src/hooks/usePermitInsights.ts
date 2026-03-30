import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PermitInsightData {
  peak_days: number[];
  best_hour_local: number | null;
  total_detections: number;
  confidence: "High" | "Medium" | "Low";
  alert_success_rate: number;
  period: string;
}

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday"];

const formatHour = (h: number): string => {
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}${ampm}`;
};

export function usePermitInsights(
  parkSlug: string | undefined,
  permitType: string | undefined
): string | null {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (!parkSlug || !permitType) return;

    supabase
      .rpc("get_permit_insights", {
        p_park_slug: parkSlug,
        p_permit_type: permitType,
      })
      .then(({ data, error }) => {
        if (error || !data) return;
        const d = data as PermitInsightData;

        // Scarcity message — rare permits need extra reassurance
        if (d.total_detections > 0 && d.total_detections < 3) {
          setInsight(
            `These are rare — only ${d.total_detections} ` +
            `spot${d.total_detections === 1 ? "" : "s"} ` +
            `found recently. I'm staying extra vigilant for you.`
          );
          return;
        }

        // No data yet — don't override fallback
        if (d.total_detections < 1) return;

        // Data-driven insight with human voice
        const timeStr = d.best_hour_local != null
          ? ` around ${formatHour(d.best_hour_local)}`
          : "";
        const dayNames = d.peak_days?.slice(0, 2)
          .map((n: number) => DAY_NAMES[n]) ?? [];
        const dayStr = dayNames.length
          ? ` on ${dayNames.join(" and ")}`
          : " lately";
        const countStr = d.total_detections >= 5
          ? ` with ${d.total_detections} spotted recently`
          : "";

        setInsight(
          `I've noticed spots opening${dayStr}${timeStr}${countStr}. ` +
          `I'll alert you the second the next one drops.`
        );
      });
  }, [parkSlug, permitType]);

  return insight;
}
