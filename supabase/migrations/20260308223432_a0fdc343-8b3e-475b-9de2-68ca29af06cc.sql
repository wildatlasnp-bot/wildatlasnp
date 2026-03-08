-- Create a security definer function to get protected field values
CREATE OR REPLACE FUNCTION public.get_profile_protected_fields(_user_id uuid)
RETURNS TABLE(phone_verified boolean, stripe_customer_id text, onboarded_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone_verified, p.stripe_customer_id, p.onboarded_at
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

-- Recreate the policy using the function
DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_pro = get_is_pro(auth.uid())
  AND phone_verified = (SELECT gp.phone_verified FROM public.get_profile_protected_fields(auth.uid()) gp)
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT gp.stripe_customer_id FROM public.get_profile_protected_fields(auth.uid()) gp)
  AND onboarded_at IS NOT DISTINCT FROM (SELECT gp.onboarded_at FROM public.get_profile_protected_fields(auth.uid()) gp)
);