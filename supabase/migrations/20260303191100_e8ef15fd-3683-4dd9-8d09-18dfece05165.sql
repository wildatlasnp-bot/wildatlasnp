-- Add park_id to active_watches with default for existing data
ALTER TABLE public.active_watches 
ADD COLUMN park_id text NOT NULL DEFAULT 'yosemite';

-- Create index for efficient park-scoped queries
CREATE INDEX idx_active_watches_park ON public.active_watches(park_id);

-- Create a parks table as the source of truth for supported parks
CREATE TABLE public.parks (
  id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  nps_code text,
  weather_lat numeric,
  weather_lon numeric,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;

-- Parks are public read
CREATE POLICY "Anyone can view parks" ON public.parks FOR SELECT USING (true);

-- Seed Yosemite as the first park
INSERT INTO public.parks (id, name, region, nps_code, weather_lat, weather_lon, timezone)
VALUES ('yosemite', 'Yosemite National Park', 'California', 'yose', 37.7456, -119.5936, 'America/Los_Angeles');

-- Create a permits registry table
CREATE TABLE public.park_permits (
  id text PRIMARY KEY,
  park_id text NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  name text NOT NULL,
  recgov_permit_id text,
  season_start text,
  season_end text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.park_permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view permits" ON public.park_permits FOR SELECT USING (true);

-- Seed Yosemite permits
INSERT INTO public.park_permits (id, park_id, name, recgov_permit_id, season_start, season_end, description) VALUES
('yosemite-half-dome', 'yosemite', 'Half Dome', '234652', '06-01', '10-15', 'Day hike cables permit'),
('yosemite-wilderness', 'yosemite', 'Yosemite Wilderness', '233262', '05-01', '11-30', 'Backcountry overnight permits');