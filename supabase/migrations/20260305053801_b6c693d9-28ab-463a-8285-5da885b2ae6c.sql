CREATE TABLE public.park_crowd_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id text NOT NULL,
  location_name text NOT NULL,
  season text NOT NULL DEFAULT 'summer',
  day_type text NOT NULL DEFAULT 'weekday',
  quiet_start text NOT NULL,
  quiet_end text NOT NULL,
  building_time text NOT NULL,
  peak_start text NOT NULL,
  peak_end text NOT NULL,
  evening_quiet text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (park_id, location_name, season, day_type)
);

ALTER TABLE public.park_crowd_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crowd forecasts"
  ON public.park_crowd_forecasts
  FOR SELECT
  USING (true);

CREATE POLICY "Block client writes to crowd forecasts"
  ON public.park_crowd_forecasts
  FOR ALL
  USING (false);