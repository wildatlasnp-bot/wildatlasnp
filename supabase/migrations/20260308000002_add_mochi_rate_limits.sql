-- Dedicated table for Mochi chat rate limiting.
-- Separates rate limit tracking from api_health_log which is for health monitoring.

CREATE TABLE public.mochi_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index optimised for the per-user time-window COUNT query used by the rate limiter
CREATE INDEX idx_mochi_rate_limits_user_window
  ON public.mochi_rate_limits(user_id, created_at);

-- Edge function uses service role key — no client access needed
ALTER TABLE public.mochi_rate_limits ENABLE ROW LEVEL SECURITY;

-- Prune rows older than 1 hour (well beyond the 60-second window) to keep the
-- table small. A cron job can call this, or it runs inline opportunistically.
CREATE OR REPLACE FUNCTION public.prune_mochi_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.mochi_rate_limits
  WHERE created_at < now() - interval '1 hour';
$$;
