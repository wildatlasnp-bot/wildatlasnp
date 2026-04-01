-- Drop the wide-open policy
DROP POLICY IF EXISTS "Anyone can view scan targets" ON public.scan_targets;

-- Users can only see targets linked to their own watchers
CREATE POLICY "Users can view own scan targets"
  ON public.scan_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_watchers
      WHERE user_watchers.scan_target_id = scan_targets.id
        AND user_watchers.user_id = auth.uid()
    )
  );

-- Admins can see all scan targets
CREATE POLICY "Admins can view all scan targets"
  ON public.scan_targets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));