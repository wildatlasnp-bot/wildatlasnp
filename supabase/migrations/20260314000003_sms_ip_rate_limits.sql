-- Dedicated table for per-IP SMS rate limiting in send-verification-code.
--
-- Tracks one row per send attempt per IP address. The edge function counts
-- rows in the last hour; if >= 10 it returns 429 before touching Twilio.
--
-- Intentionally separate from phone_verifications (OTP-purpose table) and
-- from mochi_rate_limits (Mochi chat). Same minimal pattern as mochi_rate_limits.

CREATE TABLE public.sms_ip_rate_limits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the per-IP sliding-window COUNT query.
CREATE INDEX idx_sms_ip_rate_limits_ip_window
  ON public.sms_ip_rate_limits (ip, created_at);

-- Edge function uses service role key — no client access needed.
ALTER TABLE public.sms_ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- Prune rows older than 1 hour (the full rate-limit window) to keep the
-- table small. Called inline by the edge function on each request.
CREATE OR REPLACE FUNCTION public.prune_sms_ip_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.sms_ip_rate_limits
  WHERE created_at < now() - interval '1 hour';
$$;
