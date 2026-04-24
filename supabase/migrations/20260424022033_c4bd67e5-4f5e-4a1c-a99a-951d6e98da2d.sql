CREATE OR REPLACE FUNCTION public.get_recent_finds_ticker()
RETURNS TABLE (
  id uuid,
  park_id text,
  permit_name text,
  found_at timestamp with time zone,
  available_count integer,
  park_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rf.id,
    rf.park_id,
    rf.permit_name,
    rf.found_at,
    rf.available_count,
    p.name AS park_name
  FROM public.recent_finds rf
  LEFT JOIN public.parks p ON p.id = rf.park_id
  ORDER BY rf.found_at DESC
  LIMIT 3;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_finds_ticker() TO anon, authenticated;