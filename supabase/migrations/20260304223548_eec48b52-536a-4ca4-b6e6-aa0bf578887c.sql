
ALTER TABLE public.recent_finds
  ADD COLUMN found_date date NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing rows
UPDATE public.recent_finds SET found_date = (found_at AT TIME ZONE 'UTC')::date;

-- Unique constraint for deduplication
ALTER TABLE public.recent_finds
  ADD CONSTRAINT uq_recent_finds_dedup UNIQUE (park_id, permit_name, found_date);
