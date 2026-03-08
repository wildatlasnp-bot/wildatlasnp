DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_pro = get_is_pro(auth.uid())
  AND phone_verified IS NOT DISTINCT FROM (SELECT phone_verified FROM public.profiles WHERE user_id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.profiles WHERE user_id = auth.uid())
  AND onboarded_at IS NOT DISTINCT FROM (SELECT onboarded_at FROM public.profiles WHERE user_id = auth.uid())
);