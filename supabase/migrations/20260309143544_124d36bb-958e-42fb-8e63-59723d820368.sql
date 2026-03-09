
DROP FUNCTION IF EXISTS public.get_profile_protected_fields(uuid) CASCADE;

CREATE FUNCTION public.get_profile_protected_fields(_user_id uuid)
 RETURNS TABLE(phone_verified boolean, stripe_customer_id text, onboarded_at timestamp with time zone, onboarding_step_reached integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.phone_verified, p.stripe_customer_id, p.onboarded_at, p.onboarding_step_reached
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (is_pro = get_is_pro(auth.uid()))
  AND (phone_verified = (SELECT gp.phone_verified FROM get_profile_protected_fields(auth.uid()) gp))
  AND (NOT (stripe_customer_id IS DISTINCT FROM (SELECT gp.stripe_customer_id FROM get_profile_protected_fields(auth.uid()) gp)))
  AND (NOT (onboarded_at IS DISTINCT FROM (SELECT gp.onboarded_at FROM get_profile_protected_fields(auth.uid()) gp)))
  AND (NOT (onboarding_step_reached IS DISTINCT FROM (SELECT gp.onboarding_step_reached FROM get_profile_protected_fields(auth.uid()) gp)))
);
