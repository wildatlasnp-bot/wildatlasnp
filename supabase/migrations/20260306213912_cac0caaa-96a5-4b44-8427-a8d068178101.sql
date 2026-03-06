
CREATE TABLE public.email_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'open',
  link_url text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all client access to email_tracking"
  ON public.email_tracking FOR ALL
  USING (false);

CREATE INDEX idx_email_tracking_email_log_id ON public.email_tracking(email_log_id);
CREATE INDEX idx_email_tracking_event_type ON public.email_tracking(event_type);
