
-- Allow admins to read notification_log for dead-letter monitoring
CREATE POLICY "Admins can view notification_log"
ON public.notification_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
