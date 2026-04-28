-- Cache table for AI-generated park briefs (1-hour TTL per park-hour bucket)
CREATE TABLE IF NOT EXISTS public.park_brief_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  brief TEXT NOT NULL,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  CONSTRAINT park_brief_cache_park_bucket_unique UNIQUE (park_id, bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_park_brief_cache_lookup
  ON public.park_brief_cache (park_id, bucket_key, expires_at);

ALTER TABLE public.park_brief_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read briefs (it's per-park ambient content, not user-scoped)
CREATE POLICY "Authenticated users can read park briefs"
  ON public.park_brief_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Block all client writes — only the edge function (service role) can write
CREATE POLICY "Block client writes to park briefs"
  ON public.park_brief_cache
  FOR ALL
  TO public
  USING (false);
