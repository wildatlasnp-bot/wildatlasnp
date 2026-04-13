CREATE POLICY "Block anon reads on crowd_report_events"
ON public.crowd_report_events
FOR SELECT
TO anon
USING (false);