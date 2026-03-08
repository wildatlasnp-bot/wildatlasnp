-- Recreate the view with SECURITY INVOKER (default) instead of SECURITY DEFINER
-- security_barrier is fine, but we must not use security_definer
DROP VIEW IF EXISTS public.crowd_reports_public;

CREATE VIEW public.crowd_reports_public WITH (security_barrier = true, security_invoker = true) AS
  SELECT id, park_slug, area_name, crowd_level, wait_time_minutes, reported_at
  FROM public.crowd_report_events;