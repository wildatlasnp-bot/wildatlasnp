CREATE POLICY "No direct reads on phone_verifications"
  ON public.phone_verifications
  FOR SELECT
  TO public
  USING (false);