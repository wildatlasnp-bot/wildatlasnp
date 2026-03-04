
-- 1. Create permit_availability table
CREATE TABLE public.permit_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_code text NOT NULL,
  permit_type text NOT NULL,
  date date NOT NULL,
  available_spots integer NOT NULL DEFAULT 0,
  last_checked timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (park_code, permit_type, date)
);

-- 2. Enable RLS
ALTER TABLE public.permit_availability ENABLE ROW LEVEL SECURITY;

-- 3. Public read access (anyone can view availability)
CREATE POLICY "Anyone can view permit availability"
  ON public.permit_availability
  FOR SELECT
  USING (true);

-- 4. Block client writes (only service role / edge functions write)
CREATE POLICY "Block client writes to permit_availability"
  ON public.permit_availability
  FOR ALL
  USING (false);

-- 5. Create RPC for querying by park
CREATE OR REPLACE FUNCTION public.get_permit_availability(p_park_code text)
RETURNS SETOF public.permit_availability
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT *
  FROM public.permit_availability
  WHERE park_code = p_park_code
    AND date >= CURRENT_DATE
  ORDER BY permit_type, date;
$$;
