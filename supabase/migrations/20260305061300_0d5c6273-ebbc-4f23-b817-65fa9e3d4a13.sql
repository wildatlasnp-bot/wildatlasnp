
-- Update get_permit_insights to return best_hour_local instead of best_hour_utc
CREATE OR REPLACE FUNCTION public.get_permit_insights(p_park_slug text, p_permit_type text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT *
    FROM public.permit_pattern_weekly
    WHERE park_slug = p_park_slug
      AND permit_type = p_permit_type
      AND week_start >= CURRENT_DATE - interval '30 days'
    ORDER BY week_start DESC
  ),
  agg AS (
    SELECT
      COALESCE(SUM(detections_count), 0) AS total_detections,
      ROUND(AVG(median_detection_hour_local)) AS avg_best_hour,
      ROUND(AVG(avg_alert_latency_seconds)) AS avg_latency,
      ROUND(AVG(alert_success_rate)::numeric, 2) AS avg_success_rate
    FROM recent
  ),
  top_hours AS (
    SELECT unnest(peak_hours_top3) AS h, COUNT(*) AS cnt
    FROM recent
    GROUP BY h ORDER BY cnt DESC LIMIT 3
  ),
  top_days AS (
    SELECT unnest(peak_days_top2) AS d, COUNT(*) AS cnt
    FROM recent
    GROUP BY d ORDER BY cnt DESC LIMIT 2
  )
  SELECT json_build_object(
    'total_detections', (SELECT total_detections FROM agg),
    'confidence', CASE
      WHEN (SELECT total_detections FROM agg) >= 50 THEN 'High'
      WHEN (SELECT total_detections FROM agg) >= 15 THEN 'Medium'
      ELSE 'Low'
    END,
    'best_hour_local', (SELECT avg_best_hour FROM agg),
    'peak_hours', (SELECT COALESCE(array_agg(h), '{}') FROM top_hours),
    'peak_days', (SELECT COALESCE(array_agg(d), '{}') FROM top_days),
    'avg_alert_latency_seconds', (SELECT avg_latency FROM agg),
    'alert_success_rate', (SELECT avg_success_rate FROM agg),
    'period', 'last_30_days'
  );
$$;
