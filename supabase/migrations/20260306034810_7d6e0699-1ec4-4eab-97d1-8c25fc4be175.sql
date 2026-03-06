CREATE OR REPLACE FUNCTION public.get_landing_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'watchers', (SELECT count(DISTINCT user_id) FROM active_watches WHERE is_active = true),
    'found', (SELECT count(*) FROM active_watches WHERE status = 'found'),
    'total_finds', (SELECT COALESCE(sum(total_finds), 0) FROM park_permits),
    'total_scans', (SELECT count(*) FROM api_health_log)
  );
$$;