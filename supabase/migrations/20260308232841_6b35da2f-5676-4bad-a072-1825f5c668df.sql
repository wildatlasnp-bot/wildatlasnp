
-- =============================================
-- Step 1: Create scan_targets table
-- =============================================
CREATE TABLE public.scan_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  date_window_start DATE,
  date_window_end DATE,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ DEFAULT now(),
  scan_priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_scan_target UNIQUE (park_id, permit_type, date_window_start, date_window_end)
);

-- =============================================
-- Step 2: Create user_watchers table
-- =============================================
CREATE TABLE public.user_watchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scan_target_id UUID NOT NULL REFERENCES public.scan_targets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'searching',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_watcher UNIQUE (user_id, scan_target_id)
);

-- =============================================
-- Step 3: Indexes
-- =============================================
CREATE INDEX idx_scan_targets_status ON public.scan_targets (status, next_check_at);
CREATE INDEX idx_scan_targets_park_permit ON public.scan_targets (park_id, permit_type);
CREATE INDEX idx_user_watchers_user_id ON public.user_watchers (user_id);
CREATE INDEX idx_user_watchers_scan_target ON public.user_watchers (scan_target_id);

-- =============================================
-- Step 4: Updated_at triggers
-- =============================================
CREATE TRIGGER update_scan_targets_updated_at
  BEFORE UPDATE ON public.scan_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_watchers_updated_at
  BEFORE UPDATE ON public.user_watchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Step 5: RLS policies
-- =============================================
ALTER TABLE public.scan_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchers ENABLE ROW LEVEL SECURITY;

-- scan_targets: anyone can read (public data), no client writes
CREATE POLICY "Anyone can view scan targets"
  ON public.scan_targets FOR SELECT
  USING (true);

CREATE POLICY "Block client writes to scan_targets"
  ON public.scan_targets FOR ALL
  USING (false);

-- user_watchers: users can CRUD own records
CREATE POLICY "Users can view own watchers"
  ON public.user_watchers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchers"
  ON public.user_watchers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchers"
  ON public.user_watchers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchers"
  ON public.user_watchers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- Step 6: Security definer function to find-or-create scan target + user watcher
-- =============================================
CREATE OR REPLACE FUNCTION public.create_or_join_watch(
  p_user_id UUID,
  p_park_id TEXT,
  p_permit_name TEXT,
  p_date_window_start DATE DEFAULT NULL,
  p_date_window_end DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  INSERT INTO public.scan_targets (park_id, permit_type, date_window_start, date_window_end, status)
  VALUES (p_park_id, p_permit_name, p_date_window_start, p_date_window_end, 'active')
  ON CONFLICT ON CONSTRAINT uq_scan_target DO UPDATE SET status = 'active'
  RETURNING id INTO v_scan_target_id;

  -- Create user watcher
  INSERT INTO public.user_watchers (user_id, scan_target_id, status, is_active, notify_sms)
  VALUES (p_user_id, v_scan_target_id, 'searching', true, false)
  ON CONFLICT ON CONSTRAINT uq_user_watcher DO UPDATE SET is_active = true, status = 'searching'
  RETURNING id INTO v_watcher_id;

  RETURN v_watcher_id;
END;
$$;

-- =============================================
-- Step 7: Migrate existing data from active_watches
-- =============================================
-- Create scan targets from distinct park_id + permit_name
INSERT INTO public.scan_targets (park_id, permit_type, status)
SELECT DISTINCT park_id, permit_name, 'active'
FROM public.active_watches
ON CONFLICT ON CONSTRAINT uq_scan_target DO NOTHING;

-- Create user watchers from active_watches
INSERT INTO public.user_watchers (user_id, scan_target_id, status, is_active, notify_sms, last_notified_at, created_at)
SELECT
  aw.user_id,
  st.id,
  aw.status,
  aw.is_active,
  aw.notify_sms,
  aw.last_notified_at,
  aw.created_at
FROM public.active_watches aw
JOIN public.scan_targets st ON st.park_id = aw.park_id AND st.permit_type = aw.permit_name
  AND st.date_window_start IS NULL AND st.date_window_end IS NULL
ON CONFLICT ON CONSTRAINT uq_user_watcher DO NOTHING;

-- =============================================
-- Step 8: Enable realtime for user_watchers
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_watchers;
