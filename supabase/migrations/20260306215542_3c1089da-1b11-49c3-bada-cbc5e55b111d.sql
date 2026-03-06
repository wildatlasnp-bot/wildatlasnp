
CREATE POLICY "Admins can view email_logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view email_tracking"
  ON public.email_tracking FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
