
-- ============================================================
-- A1: Extend recent_finds with event_fingerprint + available_count
-- ============================================================
ALTER TABLE public.recent_finds
  ADD COLUMN IF NOT EXISTS event_fingerprint text,
  ADD COLUMN IF NOT EXISTS available_count integer;

-- Unique constraint on fingerprint to dedupe
ALTER TABLE public.recent_finds
  ADD CONSTRAINT recent_finds_event_fingerprint_key UNIQUE (event_fingerprint);

-- Index for pattern queries
CREATE INDEX IF NOT EXISTS idx_recent_finds_park_permit_date
  ON public.recent_finds (park_id, permit_name, found_at);

-- ============================================================
-- A2: Extend notification_log with location_name + latency_seconds
-- ============================================================
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS latency_seconds numeric;

-- Index for pattern queries
CREATE INDEX IF NOT EXISTS idx_notification_log_park_permit_created
  ON public.notification_log (park_id, permit_name, created_at);

-- ============================================================
-- A3: Crowd report events (new table)
-- ============================================================
CREATE TYPE public.crowd_level AS ENUM ('Quiet', 'Manageable', 'Busy', 'Packed');

CREATE TABLE public.crowd_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  park_slug text NOT NULL,
  area_name text NOT NULL,
  crowd_level public.crowd_level NOT NULL,
  wait_time_minutes integer,
  reported_at timestamptz NOT NULL DEFAULT now(),
  report_fingerprint text NOT NULL UNIQUE
);

CREATE INDEX idx_crowd_reports_park_area_time
  ON public.crowd_report_events (park_slug, area_name, reported_at);

ALTER TABLE public.crowd_report_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read crowd reports
CREATE POLICY "Anyone can view crowd reports"
  ON public.crowd_report_events FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own reports
CREATE POLICY "Users can insert own crowd reports"
  ON public.crowd_report_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Anti-spam trigger: 1 report per user per area per 15 minutes
CREATE OR REPLACE FUNCTION public.enforce_crowd_report_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crowd_report_events
    WHERE user_id = NEW.user_id
      AND park_slug = NEW.park_slug
      AND area_name = NEW.area_name
      AND reported_at > (now() - interval '15 minutes')
  ) THEN
    RAISE EXCEPTION 'You can only report once per area every 15 minutes.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crowd_report_rate_limit
  BEFORE INSERT ON public.crowd_report_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_crowd_report_rate_limit();

-- ============================================================
-- B1: permit_pattern_weekly
-- ============================================================
CREATE TABLE public.permit_pattern_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_slug text NOT NULL,
  week_start date NOT NULL,
  permit_type text NOT NULL,
  detections_count integer NOT NULL DEFAULT 0,
  median_detection_hour_local integer,
  peak_hours_top3 integer[] DEFAULT '{}',
  peak_days_top2 integer[] DEFAULT '{}',
  avg_alert_latency_seconds numeric,
  alert_success_rate numeric,
  top_locations text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (park_slug, week_start, permit_type)
);

ALTER TABLE public.permit_pattern_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permit patterns"
  ON public.permit_pattern_weekly FOR SELECT
  USING (true);

CREATE POLICY "Block client writes to permit patterns"
  ON public.permit_pattern_weekly FOR ALL
  USING (false);

-- ============================================================
-- B2: crowd_pattern_weekly
-- ============================================================
CREATE TABLE public.crowd_pattern_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_slug text NOT NULL,
  week_start date NOT NULL,
  area_name text NOT NULL,
  reports_count integer NOT NULL DEFAULT 0,
  peak_crowd_hours_top3 integer[] DEFAULT '{}',
  busiest_day_parts text[] DEFAULT '{}',
  avg_wait_time_minutes numeric,
  most_common_crowd_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (park_slug, week_start, area_name)
);

ALTER TABLE public.crowd_pattern_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crowd patterns"
  ON public.crowd_pattern_weekly FOR SELECT
  USING (true);

CREATE POLICY "Block client writes to crowd patterns"
  ON public.crowd_pattern_weekly FOR ALL
  USING (false);

-- ============================================================
-- C: Insights functions
-- ============================================================

-- Permit insights
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
    'best_hour_utc', (SELECT avg_best_hour FROM agg),
    'peak_hours', (SELECT COALESCE(array_agg(h), '{}') FROM top_hours),
    'peak_days', (SELECT COALESCE(array_agg(d), '{}') FROM top_days),
    'avg_alert_latency_seconds', (SELECT avg_latency FROM agg),
    'alert_success_rate', (SELECT avg_success_rate FROM agg),
    'period', 'last_30_days'
  );
$$;

-- Crowd insights
CREATE OR REPLACE FUNCTION public.get_crowd_insights(p_park_slug text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT *
    FROM public.crowd_pattern_weekly
    WHERE park_slug = p_park_slug
      AND week_start >= CURRENT_DATE - interval '30 days'
  ),
  total AS (
    SELECT COALESCE(SUM(reports_count), 0) AS total_reports FROM recent
  ),
  top_areas AS (
    SELECT area_name, SUM(reports_count) AS total, 
           mode() WITHIN GROUP (ORDER BY most_common_crowd_level) AS crowd_level
    FROM recent
    GROUP BY area_name
    ORDER BY total DESC
    LIMIT 3
  ),
  peak_hours AS (
    SELECT unnest(peak_crowd_hours_top3) AS h, COUNT(*) AS cnt
    FROM recent
    GROUP BY h ORDER BY cnt DESC LIMIT 3
  )
  SELECT json_build_object(
    'total_reports', (SELECT total_reports FROM total),
    'confidence', CASE
      WHEN (SELECT total_reports FROM total) >= 50 THEN 'High'
      WHEN (SELECT total_reports FROM total) >= 15 THEN 'Medium'
      ELSE 'Low'
    END,
    'top_areas', (SELECT COALESCE(json_agg(json_build_object('area', area_name, 'reports', total, 'crowd_level', crowd_level)), '[]'::json) FROM top_areas),
    'peak_hours', (SELECT COALESCE(array_agg(h), '{}') FROM peak_hours),
    'period', 'last_30_days'
  );
$$;

-- ============================================================
-- Retention: 90-day cleanup for crowd_report_events
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_crowd_reports()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  DELETE FROM public.crowd_report_events
  WHERE reported_at < now() - interval '90 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_crowd_reports
  AFTER INSERT ON public.crowd_report_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_crowd_reports();
