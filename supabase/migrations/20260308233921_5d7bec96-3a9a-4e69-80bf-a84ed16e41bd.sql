-- Update create_or_join_watch to elevate scan_priority and reset next_check_at when a user joins
CREATE OR REPLACE FUNCTION public.create_or_join_watch(
  p_user_id uuid,
  p_park_id text,
  p_permit_name text,
  p_date_window_start date DEFAULT NULL,
  p_date_window_end date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scan_target_id UUID;
  v_watcher_id UUID;
  _is_pro BOOLEAN;
  _active_count INTEGER;
BEGIN
  -- Enforce watch limit for free users
  SELECT COALESCE(is_pro, false) INTO _is_pro
  FROM public.profiles WHERE user_id = p_user_id;

  IF NOT _is_pro THEN
    SELECT count(*) INTO _active_count
    FROM public.user_watchers
    WHERE user_id = p_user_id AND is_active = true;

    IF _active_count >= 1 THEN
      RAISE EXCEPTION 'Free plan limited to 1 active watch. Upgrade to Pro for unlimited watches.';
    END IF;
  END IF;

  -- Enforce total watch cap
  SELECT count(*) INTO _active_count
  FROM public.user_watchers WHERE user_id = p_user_id;
  IF _active_count >= 20 THEN
    RAISE EXCEPTION 'Maximum of 20 total watches reached. Delete unused watches to add new ones.';
  END IF;

  -- Find or create scan target
  -- On conflict (existing target): elevate priority to high (2) and reset next_check_at to now
  INSERT INTO public.scan_targets (park_id, permit_type, date_window_start, date_window_end, status, scan_priority, next_check_at)
  VALUES (p_park_id, p_permit_name, p_date_window_start, p_date_window_end, 'active', 2, now())
  ON CONFLICT ON CONSTRAINT uq_scan_target DO UPDATE SET 
    status = 'active',
    scan_priority = GREATEST(scan_targets.scan_priority, 2),  -- Elevate to high priority
    next_check_at = now()  -- Reset for immediate scan
  RETURNING id INTO v_scan_target_id;

  -- Create user watcher
  INSERT INTO public.user_watchers (user_id, scan_target_id, status, is_active, notify_sms)
  VALUES (p_user_id, v_scan_target_id, 'searching', true, false)
  ON CONFLICT ON CONSTRAINT uq_user_watcher DO UPDATE SET is_active = true, status = 'searching'
  RETURNING id INTO v_watcher_id;

  RETURN v_watcher_id;
END;
$function$;