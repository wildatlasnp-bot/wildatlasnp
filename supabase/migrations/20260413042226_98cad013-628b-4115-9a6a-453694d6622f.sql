-- 1. Drop policy first (it depends on the function)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Drop and recreate function with is_pro
DROP FUNCTION IF EXISTS public.get_profile_protected_fields(uuid);

CREATE FUNCTION public.get_profile_protected_fields(_user_id uuid)
 RETURNS TABLE(
   phone_verified boolean,
   stripe_customer_id text,
   onboarded_at timestamp with time zone,
   onboarding_step_reached integer,
   subscription_end timestamp with time zone,
   welcomed_at timestamp with time zone,
   is_pro boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.phone_verified, p.stripe_customer_id, p.onboarded_at,
         p.onboarding_step_reached, p.subscription_end, p.welcomed_at, p.is_pro
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

-- 3. Recreate policy with is_pro using IS NOT DISTINCT FROM
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (NOT (is_pro IS DISTINCT FROM (
    SELECT gp.is_pro FROM get_profile_protected_fields(auth.uid()) gp
  )))
  AND (phone_verified = (
    SELECT gp.phone_verified FROM get_profile_protected_fields(auth.uid()) gp
  ))
  AND (NOT (stripe_customer_id IS DISTINCT FROM (
    SELECT gp.stripe_customer_id FROM get_profile_protected_fields(auth.uid()) gp
  )))
  AND (NOT (onboarded_at IS DISTINCT FROM (
    SELECT gp.onboarded_at FROM get_profile_protected_fields(auth.uid()) gp
  )))
  AND (NOT (onboarding_step_reached IS DISTINCT FROM (
    SELECT gp.onboarding_step_reached FROM get_profile_protected_fields(auth.uid()) gp
  )))
  AND (NOT (subscription_end IS DISTINCT FROM (
    SELECT gp.subscription_end FROM get_profile_protected_fields(auth.uid()) gp
  )))
  AND (NOT (welcomed_at IS DISTINCT FROM (
    SELECT gp.welcomed_at FROM get_profile_protected_fields(auth.uid()) gp
  )))
);