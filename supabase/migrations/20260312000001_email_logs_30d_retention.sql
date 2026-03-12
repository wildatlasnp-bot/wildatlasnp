-- Retention policy: email_logs and email_tracking (30 days).
--
-- email_logs contains recipient_email (PII). Rows are send-attempt records
-- with no operational value beyond 30 days.
--
-- email_tracking is the child table (FK ON DELETE SET NULL). It stores
-- ip_address and user_agent per open/click event — also PII. Cleaned on the
-- same 30-day schedule before the parent rows are deleted, so the FK nulling
-- on email_logs deletion is a non-issue.
--
-- pg_cron chosen over an insert trigger: email sends are infrequent relative
-- to permit-scanning writes, and a scheduled job avoids per-write overhead.
-- Scheduled: daily at 02:00 UTC.

-- Support efficient range-delete on email_tracking
CREATE INDEX IF NOT EXISTS idx_email_tracking_created_at
  ON public.email_tracking (created_at);

-- Support efficient range-delete on email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON public.email_logs (created_at);

CREATE OR REPLACE FUNCTION public.purge_old_email_logs()
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Delete email_tracking rows first (child table); avoids FK SET NULL churn
  -- on email_logs deletion and removes ip_address / user_agent PII.
  DELETE FROM public.email_tracking
  WHERE created_at < now() - interval '30 days';

  -- Delete email_logs rows: recipient_email PII, 30-day retention.
  DELETE FROM public.email_logs
  WHERE created_at < now() - interval '30 days';
END;
$$;

SELECT cron.schedule(
  'purge-email-logs-30d',
  '0 2 * * *',
  'SELECT public.purge_old_email_logs()'
);
