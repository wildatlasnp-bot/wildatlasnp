
-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.pro_waitlist;
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON public.pro_waitlist;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Authenticated users can join waitlist"
ON public.pro_waitlist
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own waitlist entry"
ON public.pro_waitlist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
