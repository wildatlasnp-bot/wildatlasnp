
-- Drop all existing restrictive policies on pro_waitlist
DROP POLICY IF EXISTS "Users can insert own waitlist entry" ON public.pro_waitlist;
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON public.pro_waitlist;

-- Create permissive INSERT policy for both anon and authenticated
CREATE POLICY "Anyone can join waitlist"
ON public.pro_waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create permissive SELECT policy so upsert works
CREATE POLICY "Users can view own waitlist entry"
ON public.pro_waitlist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
