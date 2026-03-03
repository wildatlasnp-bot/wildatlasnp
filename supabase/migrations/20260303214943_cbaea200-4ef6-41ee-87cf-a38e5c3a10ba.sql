
-- Cache table for Recreation.gov API responses
CREATE TABLE public.permit_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,  -- "park_id:permit_name"
  recgov_id text NOT NULL,
  api_type text NOT NULL DEFAULT 'standard',
  available boolean NOT NULL DEFAULT false,
  available_dates text[] NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  stale_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_status_code integer
);

-- Index for fast lookups
CREATE INDEX idx_permit_cache_key ON public.permit_cache (cache_key);
CREATE INDEX idx_permit_cache_stale ON public.permit_cache (stale_at);

-- RLS: service role only
ALTER TABLE public.permit_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all client access to permit_cache"
  ON public.permit_cache FOR ALL
  USING (false);

-- API health log for monitoring
CREATE TABLE public.api_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  status_code integer,
  response_time_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_health_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all client access to api_health_log"
  ON public.api_health_log FOR ALL
  USING (false);

-- Auto-cleanup old health logs (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_api_health_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_health_log
  WHERE created_at < now() - interval '7 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_api_health
  AFTER INSERT ON public.api_health_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_api_health_log();
