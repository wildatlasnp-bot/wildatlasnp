CREATE OR REPLACE FUNCTION public.enforce_total_watch_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_count integer;
  _max_total integer := 20;
BEGIN
  SELECT count(*) INTO _total_count
  FROM public.active_watches
  WHERE user_id = NEW.user_id;

  IF _total_count >= _max_total THEN
    RAISE EXCEPTION 'Maximum of % total watches reached. Delete unused watches to add new ones.', _max_total;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_total_watch_cap_trigger
  BEFORE INSERT ON public.active_watches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_total_watch_cap();