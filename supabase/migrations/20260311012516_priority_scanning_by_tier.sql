-- Implement tier-based scan priority for Pro vs free users.
-- Pro users (is_pro = true): scan_priority = 2 → 2 min scan interval
-- Free users (is_pro = false): scan_priority = 1 → 5 min scan interval
-- scan_priority = 0 is reserved for low-activity/orphaned targets

-- ── Helper: recalculate priority for one scan_target based on current watcher composition ──
CREATE OR REPLACE FUNCTION public.recalculate_scan_target_priority(p_scan_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  has_pro_watcher boolean;
  has_any_watcher boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_watchers uw
    JOIN public.profiles pr ON pr.user_id = uw.user_id
    WHERE uw.scan_target_id = p_scan_target_id
      AND uw.is_active = true
      AND pr.is_pro = true
  ) INTO has_pro_watcher;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_watchers uw
    WHERE uw.scan_target_id = p_scan_target_id
      AND uw.is_active = true
  ) INTO has_any_watcher;

  UPDATE public.scan_targets
  SET scan_priority = CASE
    WHEN has_pro_watcher THEN 2   -- any Pro watcher → high priority (2 min)
    WHEN has_any_watcher THEN 1   -- free-only watchers → medium priority (5 min)
    ELSE scan_priority            -- orphaned: keep current (managed separately)
  END
  WHERE id = p_scan_target_id;
END;
$$;

-- ── Update create_or_join_watch: set priority based on joining user's tier ──
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

-- ── Trigger: recalculate scan_target priority when a user's is_pro status changes ──
CREATE OR REPLACE FUNCTION public.sync_scan_priority_on_pro_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_id uuid;
BEGIN
  -- Only act when is_pro actually changes
  IF NEW.is_pro = OLD.is_pro THEN
    RETURN NEW;
  END IF;

  -- Recalculate priority for all scan_targets this user is actively watching
  FOR target_id IN
    SELECT DISTINCT scan_target_id
    FROM public.user_watchers
    WHERE user_id = NEW.user_id AND is_active = true
  LOOP
    PERFORM public.recalculate_scan_target_priority(target_id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_scan_priority_on_pro_change
AFTER UPDATE OF is_pro ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_scan_priority_on_pro_change();

-- ── Index: support priority-ordered queue scan efficiently ──
CREATE INDEX IF NOT EXISTS idx_scan_targets_queue_priority
  ON public.scan_targets (scan_priority DESC, next_check_at ASC)
  WHERE status = 'active';

-- ── Backfill: recalculate priority for all existing active scan_targets ──
-- All targets currently have scan_priority=2 regardless of watcher tier.
-- This corrects free-only targets to priority 1 (medium, 5 min interval).
UPDATE public.scan_targets st
SET scan_priority = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_watchers uw
    JOIN public.profiles pr ON pr.user_id = uw.user_id
    WHERE uw.scan_target_id = st.id AND uw.is_active = true AND pr.is_pro = true
  ) THEN 2
  WHEN EXISTS (
    SELECT 1 FROM public.user_watchers uw
    WHERE uw.scan_target_id = st.id AND uw.is_active = true
  ) THEN 1
  ELSE st.scan_priority  -- orphaned: keep as-is
END
WHERE st.status = 'active';
