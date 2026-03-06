-- Anonymize crowd reports: replace the public SELECT policy to hide user_id
DROP POLICY IF EXISTS "Anyone can view crowd reports" ON public.crowd_report_events;

-- Create a view that excludes user_id for public reads
CREATE OR REPLACE VIEW public.crowd_reports_public
WITH (security_invoker = on) AS
  SELECT id, park_slug, area_name, crowd_level, wait_time_minutes, reported_at
  FROM public.crowd_report_events;

-- Allow authenticated users to read their own rows (needed for rate-limit check in trigger)
CREATE POLICY "Users can view own crowd reports"
  ON public.crowd_report_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);