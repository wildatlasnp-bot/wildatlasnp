-- Explicitly block client-side DELETE on profiles.
-- Deletion flows through delete-account Edge Function via service role key,
-- which bypasses RLS. This policy makes the intent explicit and closes the
-- audit gap identified in the 2026-03-22 security review.

CREATE POLICY "No client delete"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (false);
