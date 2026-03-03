
-- Store NPS park alerts/closures
CREATE TABLE public.park_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id text NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  nps_alert_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Information',
  url text,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS - public read, no client writes
ALTER TABLE public.park_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view park alerts"
ON public.park_alerts
FOR SELECT
USING (true);

CREATE POLICY "Block client writes to park_alerts"
ON public.park_alerts
FOR ALL
USING (false);

-- Index for quick park lookups
CREATE INDEX idx_park_alerts_park_id ON public.park_alerts(park_id);
