-- Per-endpoint circuit breaker for Recreation.gov API families.
-- Granularity: one row per API family ('permits' | 'permitinyo' | 'permititinerary').
-- Half-open state is derived in application code: state='open' AND cooldown_until <= now().
-- Atomicity: both write RPCs use SELECT FOR UPDATE before mutating.

CREATE TABLE public.endpoint_circuit_breakers (
  endpoint_key     text PRIMARY KEY,            -- 'permits' | 'permitinyo' | 'permititinerary'
  state            text NOT NULL DEFAULT 'closed',  -- 'closed' | 'open'
  consecutive_429s integer NOT NULL DEFAULT 0,
  opened_at        timestamptz,
  cooldown_until   timestamptz,
  last_429_at      timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS: internal only (service role writes; no client access)
ALTER TABLE public.endpoint_circuit_breakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block client access to endpoint_circuit_breakers"
  ON public.endpoint_circuit_breakers FOR ALL USING (false);

-- Pre-seed one row per endpoint family so RPCs can always UPDATE (never need to INSERT)
INSERT INTO public.endpoint_circuit_breakers (endpoint_key) VALUES
  ('permits'),
  ('permitinyo'),
  ('permititinerary')
ON CONFLICT (endpoint_key) DO NOTHING;

-- ── RPC: record a 429 for an endpoint; atomically increment counter + conditionally open ──
-- p_cooldown_seconds: use Retry-After value (or default 600) from the caller.
-- Returns: new_state, new_count, cooldown_until, prev_state
CREATE OR REPLACE FUNCTION public.record_endpoint_429(
  p_endpoint_key     text,
  p_cooldown_seconds integer DEFAULT 600
)
RETURNS TABLE(new_state text, new_count integer, cooldown_until timestamptz, prev_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_threshold   constant integer := 3;
  v_row         record;
  v_new_count   integer;
  v_new_state   text;
  v_cooldown    timestamptz;
  v_opened_at   timestamptz;
BEGIN
  -- Row-level lock prevents concurrent workers from racing on the counter
  SELECT * INTO v_row
  FROM public.endpoint_circuit_breakers
  WHERE endpoint_key = p_endpoint_key
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_new_count := v_row.consecutive_429s + 1;
  v_new_state := v_row.state;
  v_cooldown  := v_row.cooldown_until;
  v_opened_at := v_row.opened_at;

  IF v_new_count >= v_threshold OR v_row.state = 'open' THEN
    -- Open or stay open: always reset cooldown to give the endpoint time to recover
    v_new_state := 'open';
    v_cooldown  := now() + (p_cooldown_seconds || ' seconds')::interval;
    IF v_row.state != 'open' THEN
      v_opened_at := now();
    END IF;
  END IF;

  UPDATE public.endpoint_circuit_breakers SET
    state            = v_new_state,
    consecutive_429s = v_new_count,
    opened_at        = v_opened_at,
    cooldown_until   = v_cooldown,
    last_429_at      = now(),
    updated_at       = now()
  WHERE endpoint_key = p_endpoint_key;

  RETURN QUERY SELECT v_new_state, v_new_count, v_cooldown, v_row.state;
END;
$$;

-- ── RPC: record a successful response; close circuit if it was open/half-open ──
-- Returns: prev_state, new_state
CREATE OR REPLACE FUNCTION public.record_endpoint_success(p_endpoint_key text)
RETURNS TABLE(prev_state text, new_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT * INTO v_row
  FROM public.endpoint_circuit_breakers
  WHERE endpoint_key = p_endpoint_key
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_row.state = 'open' THEN
    UPDATE public.endpoint_circuit_breakers SET
      state            = 'closed',
      consecutive_429s = 0,
      opened_at        = NULL,
      cooldown_until   = NULL,
      updated_at       = now()
    WHERE endpoint_key = p_endpoint_key;
  END IF;

  RETURN QUERY SELECT v_row.state, CASE WHEN v_row.state = 'open' THEN 'closed'::text ELSE v_row.state END;
END;
$$;
