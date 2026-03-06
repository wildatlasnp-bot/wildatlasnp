
-- Track one-time emails so they never repeat
CREATE TABLE public.pro_nudge_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.pro_nudge_emails ENABLE ROW LEVEL SECURITY;

-- No client access needed — only edge functions use this
CREATE POLICY "Block all client access to pro_nudge_emails"
  ON public.pro_nudge_emails FOR ALL
  USING (false);
