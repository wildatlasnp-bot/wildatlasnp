-- Defense-in-depth: explicitly block all client (anon/authenticated) access
-- to email_send_state. Service role retains full access via the existing
-- "Service role can manage send state" ALL policy.
CREATE POLICY "Block client access to email_send_state"
ON public.email_send_state
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);