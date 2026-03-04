
-- Drop the existing UPDATE policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a new UPDATE policy that prevents users from changing is_pro
-- Users can only update their own row AND is_pro must remain unchanged
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_pro = (SELECT p.is_pro FROM public.profiles p WHERE p.user_id = auth.uid())
);
