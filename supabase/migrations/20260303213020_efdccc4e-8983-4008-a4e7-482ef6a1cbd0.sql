CREATE OR REPLACE FUNCTION public.increment_permit_finds(p_park_id text, p_permit_name text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.park_permits
  SET total_finds = total_finds + 1
  WHERE park_id = p_park_id AND name = p_permit_name;
$$;