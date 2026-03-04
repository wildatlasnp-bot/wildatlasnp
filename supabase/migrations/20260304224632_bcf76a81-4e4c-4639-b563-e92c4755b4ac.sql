
-- Add last_notified_at to active_watches for duplicate notification guard
ALTER TABLE public.active_watches ADD COLUMN IF NOT EXISTS last_notified_at timestamptz DEFAULT NULL;

-- Replace increment_permit_finds with a version that checks for existing row first
CREATE OR REPLACE FUNCTION public.increment_permit_finds(p_park_id text, p_permit_name text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _existing_id uuid;
  _inserted boolean := false;
BEGIN
  -- Try to insert; if conflict, do nothing and flag not inserted
  INSERT INTO public.recent_finds (park_id, permit_name, found_date, available_dates)
  VALUES (p_park_id, p_permit_name, CURRENT_DATE, '{}'::text[])
  ON CONFLICT (park_id, permit_name, found_date) DO NOTHING
  RETURNING id INTO _existing_id;

  -- Only increment if we actually inserted a new row
  IF _existing_id IS NOT NULL THEN
    UPDATE public.park_permits
    SET total_finds = total_finds + 1
    WHERE park_id = p_park_id AND name = p_permit_name;
  END IF;
END;
$$;
