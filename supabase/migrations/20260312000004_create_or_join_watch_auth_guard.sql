-- Add caller-identity enforcement to create_or_join_watch.
--
-- The SECURITY DEFINER function previously accepted p_user_id from the caller
-- without verifying it matched the calling user. An authenticated user could
-- pass any UUID as p_user_id and create/join watches on another user's behalf.
--
-- Fix: check auth.uid() (session GUC, preserved across SECURITY DEFINER
-- boundary) as the first statement and raise if it doesn't match p_user_id.
-- The IS NULL guard also rejects unauthenticated (anon key) calls.
--
-- All legitimate callers (useSniperData, OnboardingFlow, AddPermitModal,
-- AddParkModal) pass the authenticated user's own ID — no caller change needed.

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
  v_priority INTEGER;
BEGIN
  -- Verify the caller is authenticated and is acting on their own behalf.
  -- auth.uid() reads request.jwt.claims, a session-level GUC set by PostgREST
  -- from the caller's JWT. SECURITY DEFINER changes the execution role but
  -- does not affect session GUCs, so auth.uid() correctly reflects the calling
  -- user here. The IS NULL guard rejects unauthenticated (anon key) calls.
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: p_user_id does not match authenticated user';
  END IF;

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

  -- Set priority based on joining user's tier.
  -- Pro: high (2). Free: medium (1). On conflict, never lower existing priority.
  v_priority := CASE WHEN _is_pro THEN 2 ELSE 1 END;

  -- Find or create scan target
  INSERT INTO public.scan_targets (park_id, permit_type, date_window_start, date_window_end, status, scan_priority, next_check_at, orphaned_at)
  VALUES (p_park_id, p_permit_name, p_date_window_start, p_date_window_end, 'active', v_priority, now(), NULL)
  ON CONFLICT ON CONSTRAINT uq_scan_target DO UPDATE SET
    status = 'active',
    scan_priority = GREATEST(scan_targets.scan_priority, EXCLUDED.scan_priority),
    next_check_at = now(),
    orphaned_at = NULL
  RETURNING id INTO v_scan_target_id;

  -- Create user watcher
  INSERT INTO public.user_watchers (user_id, scan_target_id, status, is_active, notify_sms)
  VALUES (p_user_id, v_scan_target_id, 'searching', true, false)
  ON CONFLICT ON CONSTRAINT uq_user_watcher DO UPDATE SET is_active = true, status = 'searching'
  RETURNING id INTO v_watcher_id;

  RETURN v_watcher_id;
END;
$function$;
