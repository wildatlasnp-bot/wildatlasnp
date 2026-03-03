
CREATE POLICY "Users can update own waitlist entry"
ON public.pro_waitlist
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
