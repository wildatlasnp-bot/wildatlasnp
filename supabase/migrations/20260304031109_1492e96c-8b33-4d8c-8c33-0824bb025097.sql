
-- Function to enforce free-tier watch limit (1 active watch for non-pro users)
CREATE OR REPLACE FUNCTION public.enforce_watch_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_pro boolean;
  _active_count integer;
BEGIN
  -- Check if user is pro
  SELECT COALESCE(is_pro, false) INTO _is_pro
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Pro users bypass the limit
  IF _is_pro THEN
    RETURN NEW;
  END IF;

  -- Count existing active watches for this user
  SELECT count(*) INTO _active_count
  FROM public.active_watches
  WHERE user_id = NEW.user_id
    AND is_active = true;

  -- Free users limited to 1 active watch
  IF _active_count >= 1 AND NEW.is_active = true THEN
    RAISE EXCEPTION 'Free plan limited to 1 active watch. Upgrade to Pro for unlimited watches.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on insert
CREATE TRIGGER check_watch_limit_on_insert
BEFORE INSERT ON public.active_watches
FOR EACH ROW
EXECUTE FUNCTION public.enforce_watch_limit();

-- Also enforce on update (e.g. reactivating a watch)
CREATE TRIGGER check_watch_limit_on_update
BEFORE UPDATE ON public.active_watches
FOR EACH ROW
WHEN (NEW.is_active = true AND OLD.is_active = false)
EXECUTE FUNCTION public.enforce_watch_limit();
