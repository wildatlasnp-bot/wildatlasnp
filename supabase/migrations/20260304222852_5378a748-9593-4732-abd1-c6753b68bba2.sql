
ALTER TABLE public.notification_log
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN next_retry_at timestamptz,
  ADD COLUMN available_dates text[] NOT NULL DEFAULT '{}';

-- Index for the retry queue query
CREATE INDEX idx_notification_log_retry_queue
  ON public.notification_log (next_retry_at)
  WHERE status = 'failed' AND retry_count < max_retries AND next_retry_at IS NOT NULL;
