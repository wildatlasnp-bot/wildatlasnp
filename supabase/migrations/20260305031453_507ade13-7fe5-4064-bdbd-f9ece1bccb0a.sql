-- Add new columns with sensible defaults
ALTER TABLE public.recent_finds
  ADD COLUMN IF NOT EXISTS location_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'recreation.gov';

-- Backfill location_name for existing rows
UPDATE public.recent_finds SET location_name = 'Yosemite National Park' WHERE park_id = 'yosemite' AND location_name = '';
UPDATE public.recent_finds SET location_name = 'Mount Rainier National Park' WHERE park_id = 'rainier' AND location_name = '';

-- Update cleanup trigger to keep 100 instead of 50
CREATE OR REPLACE FUNCTION public.cleanup_recent_finds()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.recent_finds
  WHERE id NOT IN (
    SELECT id FROM public.recent_finds
    ORDER BY found_at DESC
    LIMIT 100
  );
  RETURN NEW;
END;
$function$;