-- Link notification_log rows back to the notification_queue row that produced them.
--
-- Root cause this addresses:
--   fan-out-notifications and retry-notifications are two independent send paths.
--   Both read from different tables (notification_queue vs notification_log) and
--   neither knows whether the other has already sent the notification.
--
--   Failure scenario:
--     1. fan-out calls send-permit-email → email delivered, but HTTP response
--        back to fan-out times out → sendEmail catch block logs notification_log
--        with status='failed' and returns false.
--     2. fan-out sets queue row back to 'pending' (not 'sent').
--     3. retry-notifications picks up the failed log entry, sends a second email,
--        marks notification_log 'sent', deactivates the watcher — but NEVER
--        touches notification_queue.
--     4. On the next fan-out cycle the queue row is still 'pending' and fan-out
--        sends a third email.
--
-- Fix:
--   Add queue_id to notification_log.  fan-out populates it when it logs.
--   retry-notifications uses it to mark the corresponding queue row 'sent'
--   when a retry succeeds, preventing fan-out from reprocessing it.
--
--   fan-out also performs a pre-send dedup check: if notification_log already
--   has a 'sent' row for (user_id, park_id, permit_name, channel) within the
--   last 24 h, the queue row is closed without sending (belt-and-suspenders).

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.notification_queue(id) ON DELETE SET NULL;

-- Index supports the retry-notifications UPDATE and the pre-send dedup lookup.
CREATE INDEX IF NOT EXISTS idx_notification_log_queue_id
  ON public.notification_log (queue_id)
  WHERE queue_id IS NOT NULL;

-- Index supports the pre-send dedup check in fan-out:
--   SELECT 1 FROM notification_log
--   WHERE user_id = $1 AND park_id = $2 AND permit_name = $3
--     AND channel = $4 AND status = 'sent'
--     AND created_at > now() - interval '24 hours'
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_dedup
  ON public.notification_log (user_id, park_id, permit_name, channel, created_at)
  WHERE status = 'sent';
