
-- Notification queue table for batch fan-out
CREATE TABLE public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL,
  user_id uuid NOT NULL,
  park_id text NOT NULL,
  permit_name text NOT NULL,
  available_dates text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Index for the fan-out worker to grab pending items efficiently
CREATE INDEX idx_notification_queue_pending 
  ON public.notification_queue (status, created_at) 
  WHERE status = 'pending';

-- RLS: block all client access (server-only table)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all client access to notification_queue"
  ON public.notification_queue FOR ALL
  TO authenticated, anon
  USING (false);
