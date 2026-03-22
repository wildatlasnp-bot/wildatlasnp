-- Enable RLS and block all client access to processed_stripe_events.
-- Add pg_cron job to purge rows older than 30 days.

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access"
  ON public.processed_stripe_events
  FOR ALL
  TO authenticated
  USING (false);

SELECT cron.schedule(
  'purge-processed-stripe-events-30d',
  '0 4 * * *',
  $$DELETE FROM public.processed_stripe_events
    WHERE processed_at < now() - interval '30 days'$$
);
