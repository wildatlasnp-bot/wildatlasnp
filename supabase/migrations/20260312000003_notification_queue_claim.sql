-- Add atomic claim protection to notification_queue.
--
-- Workers claim rows by calling claim_notification_queue_batch(), which atomically
-- transitions status 'pending' → 'processing' using FOR UPDATE SKIP LOCKED.
-- Two concurrent workers are guaranteed to receive disjoint row sets.
--
-- Stale 'processing' rows (claimed_at older than 5 min, indicating a worker crash)
-- are automatically reclaimed by the same claim function on the next invocation.
-- No separate reclaim job is needed.

-- Track when a worker claimed a row for in-flight processing.
ALTER TABLE public.notification_queue
  ADD COLUMN claimed_at timestamptz;

-- Index supporting the stale-reclaim predicate in claim_notification_queue_batch:
-- finds processing rows whose claim has expired.
CREATE INDEX idx_notification_queue_processing_claimed_at
  ON public.notification_queue (claimed_at ASC)
  WHERE status = 'processing';

-- Atomic batch-claim function.
-- Claims up to p_batch_size rows eligible for processing:
--   a) status = 'pending'                                       — never claimed
--   b) status = 'processing' AND claimed_at < now() - 5 min   — abandoned claim
-- FOR UPDATE SKIP LOCKED ensures concurrent callers receive disjoint row sets.
-- Returns only the rows claimed by this specific call.
CREATE OR REPLACE FUNCTION public.claim_notification_queue_batch(
  p_batch_size integer DEFAULT 100
)
RETURNS SETOF public.notification_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.notification_queue
  SET status = 'processing',
      claimed_at = now()
  WHERE id IN (
    SELECT id
    FROM public.notification_queue
    WHERE status = 'pending'
       OR (status = 'processing' AND claimed_at < now() - interval '5 minutes')
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
