
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the authenticated user to complete their own onboarding
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET onboarded_at = now(),
      onboarding_step_reached = GREATEST(onboarding_step_reached, 4)
  WHERE user_id = p_user_id
    AND onboarded_at IS NULL;
END;
$$;
