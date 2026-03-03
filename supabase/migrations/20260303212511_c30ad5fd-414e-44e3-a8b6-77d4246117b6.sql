
-- Public table to store recent permit cancellations/finds for social proof
CREATE TABLE public.recent_finds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id text NOT NULL,
  permit_name text NOT NULL,
  found_at timestamptz NOT NULL DEFAULT now(),
  available_dates text[] DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.recent_finds ENABLE ROW LEVEL SECURITY;

-- Anyone can read recent finds (public social proof)
CREATE POLICY "Anyone can view recent finds"
ON public.recent_finds
FOR SELECT
USING (true);

-- No client insert/update/delete
CREATE POLICY "Block client writes to recent_finds"
ON public.recent_finds
FOR ALL
USING (false);

-- Index for fast ordering
CREATE INDEX idx_recent_finds_found_at ON public.recent_finds (found_at DESC);

-- Auto-cleanup: keep only last 50 entries via trigger
CREATE OR REPLACE FUNCTION public.cleanup_recent_finds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.recent_finds
  WHERE id NOT IN (
    SELECT id FROM public.recent_finds
    ORDER BY found_at DESC
    LIMIT 50
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_recent_finds
AFTER INSERT ON public.recent_finds
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_recent_finds();
