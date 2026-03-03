
-- Drop the restrictive INSERT policy
DROP POLICY "Users can insert own waitlist entry" ON public.pro_waitlist;

-- Recreate as permissive
CREATE POLICY "Users can insert own waitlist entry"
ON public.pro_waitlist
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
