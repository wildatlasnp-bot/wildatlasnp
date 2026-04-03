DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.pro_waitlist;

CREATE POLICY "Auth users can join waitlist" ON public.pro_waitlist
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);