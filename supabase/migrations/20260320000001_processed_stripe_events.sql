CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.processed_stripe_events (processed_at);
-- TODO: add pg_cron cleanup for rows older than 30 days
