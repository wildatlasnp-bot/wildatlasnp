-- Fix email_logs: Add a restrictive policy that blocks all client access
-- (Service role bypasses RLS, so edge functions can still write)
CREATE POLICY "Block all client access to email_logs"
ON public.email_logs
FOR ALL
TO authenticated, anon
USING (false);

-- Ensure pro_waitlist users cannot delete their entries
-- (Already no DELETE policy, but let's be explicit)
CREATE POLICY "Block delete on pro_waitlist"
ON public.pro_waitlist
FOR DELETE
TO authenticated
USING (false);