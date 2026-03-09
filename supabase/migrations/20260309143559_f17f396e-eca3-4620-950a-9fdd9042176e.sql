
CREATE OR REPLACE FUNCTION public.update_onboarding_step(p_user_id uuid, p_step integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET onboarding_step_reached = GREATEST(onboarding_step_reached, p_step)
  WHERE user_id = p_user_id;
END;
$$;
