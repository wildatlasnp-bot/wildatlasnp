-- Atomic dedup for concurrent fan-out workers.
--
-- Problem fixed:
--   fan-out-notifications used a non-atomic read-check-send pattern:
--     1. SELECT notification_log WHERE status='sent' AND event_fingerprint=F (hasSentRecently)
--     2. If no row found: send email/SMS
--     3. INSERT notification_log with status='sent'
--
--   Two concurrent fan-out workers processing queue items for the same
--   (user_id, event_fingerprint, channel) could both execute step 1 before
--   either completed step 3, causing duplicate sends.
--
-- Fix:
--   Add a 'claimed' status so fan-out can atomically reserve the send slot
--   before touching the downstream email/SMS service.  The partial unique
--   index below ensures only one worker can hold the claim at a time.
--   A 23505 from the INSERT means another worker already claimed or completed
--   the send — skip without sending.
--
--   Partial index covers status IN ('claimed', 'sent') so that:
--     - 'failed' rows are excluded → retry-notifications can pick them up
--       and update to 'sent' without blocking.
--     - 'claimed' rows DO block concurrent workers → exactly-once send
--       while the claim is held.
--     - event_fingerprint IS NOT NULL required because NULL values are not
--       equal under SQL UNIQUE semantics.

-- Step 1: Extend the status CHECK constraint to allow 'claimed'.
--
-- Find the existing status check constraint by its definition (handles any
-- auto-generated name), drop it, then add the updated constraint.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'notification_log'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.notification_log DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'claimed'));

-- Step 2: Partial unique index that enforces exactly-once claim per event.
--
-- Only one row with status 'claimed' or 'sent' can exist per
-- (user_id, event_fingerprint, channel) triple at any time.
--
-- Behavior under concurrent workers:
--   Worker A: INSERT status='claimed' → succeeds (first writer)
--   Worker B: INSERT status='claimed' → 23505 (blocked by index) → skip send
--
-- Behavior on send completion:
--   Worker A success: UPDATE id=X SET status='sent' → allowed (one 'sent' row)
--   Worker A failure: UPDATE id=X SET status='failed' → 'failed' leaves index
--                     → retry-notifications can pick up row X and update to
--                       'sent' later without constraint conflict.
--
-- Note: event_fingerprint IS NOT NULL is required because NULL != NULL in SQL,
-- so two NULL fingerprints would not conflict. All fan-out paths set the
-- fingerprint before claiming, so this is safe.
CREATE UNIQUE INDEX idx_notification_log_claim_dedup
  ON public.notification_log (user_id, event_fingerprint, channel)
  WHERE status IN ('claimed', 'sent')
    AND event_fingerprint IS NOT NULL;
