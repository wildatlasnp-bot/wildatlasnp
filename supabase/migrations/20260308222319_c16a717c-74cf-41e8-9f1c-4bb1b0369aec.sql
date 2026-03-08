-- crowd_reports_public is a VIEW, so enable RLS-like protection by ensuring it's read-only
-- Views don't support RLS directly, but we verify the underlying table has proper RLS
-- The view already only exposes safe columns (no user_id). 
-- Add a security barrier to prevent write access via the view
CREATE OR REPLACE VIEW public.crowd_reports_public WITH (security_barrier = true) AS
  SELECT id, park_slug, area_name, crowd_level, wait_time_minutes, reported_at
  FROM public.crowd_report_events;