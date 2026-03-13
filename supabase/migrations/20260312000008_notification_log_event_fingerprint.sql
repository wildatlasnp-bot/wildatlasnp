-- Refine the send-layer dedup key in notification_log from permit-level to
-- event-level (opening-day-level).
--
-- Problem with the previous permit-level key (user_id, park_id, permit_name,
-- channel) within a rolling 24-hour window:
--
--   If detection A fires at 11:59 PM UTC (day D, fingerprint park:permit:D) and
--   fan-out processes it at 12:01 AM UTC (day D+1), then detection B fires at
--   12:05 AM UTC (day D+1, fingerprint park:permit:D+1 — a legitimately new
--   event), hasSentRecently would find the D+1 notification and suppress the
--   alert for the new opening.  Different permit-opening-day = different alert.
--
-- Fix:
--   Store the canonical event_fingerprint (park_id:permit_name:YYYY-MM-DD_UTC,
--   same format as recent_finds.event_fingerprint) on each notification_log row.
--   hasSentRecently now checks (user_id, event_fingerprint, channel) for an
--   exact fingerprint match rather than a rolling time window on permit identity.
--   An exact match means "same detection event, same user, same channel" —
--   which is the correct suppression criterion.

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS event_fingerprint text;

-- Index supporting hasSentRecently: exact fingerprint lookup per user+channel.
-- Replaces idx_notification_log_sent_dedup (permit-level) for the new query path.
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_fingerprint
  ON public.notification_log (user_id, event_fingerprint, channel)
  WHERE status = 'sent' AND event_fingerprint IS NOT NULL;
