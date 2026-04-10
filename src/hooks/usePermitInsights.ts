import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PermitInsightData {
  peak_days: number[];
  best_hour_local: number | null;
  total_detections: number;
  confidence: "High" | "Medium" | "Low";
  alert_success_rate: number;
  period: string;
}

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday"];

export const formatHour = (h: number): string => {
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}${ampm}`;
};

/**
 * Returns structured insight data for the briefing engine.
 * Null = no data available (cold start).
 */
export function usePermitInsights(
  parkSlug: string | undefined,
  permitType: string | undefined
): PermitInsightData | null {
  const [data, setData] = useState<PermitInsightData | null>(null);

  useEffect(() => {
    if (!parkSlug || !permitType) return;

    supabase
      .rpc("get_permit_insights", {
        p_park_slug: parkSlug,
        p_permit_type: permitType,
      })
      .then(({ data: rpcData, error }) => {
        if (error || !rpcData) return;
        try {
          const d = rpcData as unknown as PermitInsightData;
          if (typeof d.total_detections !== "number") return;
          setData(d);
        } catch {
          // Malformed RPC response — silently fall back
        }
      });
  }, [parkSlug, permitType]);

  return data;
}

/** Helper: format peak days as readable string */
export function formatPeakDays(days: number[]): string {
  const names = (days ?? []).slice(0, 2).map(n => DAY_NAMES[n]).filter(Boolean);
  if (names.length === 0) return "mid-week";
  return names.join(" and ");
}
