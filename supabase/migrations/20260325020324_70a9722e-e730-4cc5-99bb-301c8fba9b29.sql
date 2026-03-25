
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET onboarded_at = now(),
      onboarding_step_reached = GREATEST(onboarding_step_reached, 4)
  WHERE user_id = p_user_id
    AND onboarded_at IS NULL;
END;
$$;
