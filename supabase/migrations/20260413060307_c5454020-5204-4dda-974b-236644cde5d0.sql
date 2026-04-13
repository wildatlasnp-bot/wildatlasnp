
-- 1. Fix user_roles: drop the overlapping ALL policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 2. Fix get_profile_protected_fields: make parameterless, use auth.uid() internally
CREATE OR REPLACE FUNCTION public.get_profile_protected_fields()
 RETURNS TABLE(phone_verified boolean, stripe_customer_id text, onboarded_at timestamp with time zone, onboarding_step_reached integer, subscription_end timestamp with time zone, welcomed_at timestamp with time zone, is_pro boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.phone_verified, p.stripe_customer_id, p.onboarded_at,
         p.onboarding_step_reached, p.subscription_end, p.welcomed_at, p.is_pro
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$function$;

-- 3. Update the profiles UPDATE policy to use the parameterless function
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (NOT (is_pro IS DISTINCT FROM (SELECT gp.is_pro FROM get_profile_protected_fields() gp)))
  AND (phone_verified = (SELECT gp.phone_verified FROM get_profile_protected_fields() gp))
  AND (NOT (stripe_customer_id IS DISTINCT FROM (SELECT gp.stripe_customer_id FROM get_profile_protected_fields() gp)))
  AND (NOT (onboarded_at IS DISTINCT FROM (SELECT gp.onboarded_at FROM get_profile_protected_fields() gp)))
  AND (NOT (onboarding_step_reached IS DISTINCT FROM (SELECT gp.onboarding_step_reached FROM get_profile_protected_fields() gp)))
  AND (NOT (subscription_end IS DISTINCT FROM (SELECT gp.subscription_end FROM get_profile_protected_fields() gp)))
  AND (NOT (welcomed_at IS DISTINCT FROM (SELECT gp.welcomed_at FROM get_profile_protected_fields() gp)))
);
