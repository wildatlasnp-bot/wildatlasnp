
-- Create a security definer function to safely read is_pro without RLS recursion
CREATE OR REPLACE FUNCTION public.get_is_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_pro FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Replace the policy with one using the security definer function
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_pro = public.get_is_pro(auth.uid())
);
