CREATE POLICY "Users can delete own crowd reports"
  ON public.crowd_report_events
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());