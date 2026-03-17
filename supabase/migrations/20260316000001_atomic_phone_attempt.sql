-- Atomically increment the attempt counter on a phone_verifications row,
-- enforcing the 5-attempt cap in a single UPDATE.
-- Returns the updated row (attempts, code, expires_at) if the increment succeeded,
-- or zero rows if the attempt limit was already reached.
-- Called by verify-phone-code to eliminate the read-then-increment race condition.
CREATE OR REPLACE FUNCTION increment_phone_attempt(p_verification_id uuid)
RETURNS TABLE (attempts int, code text, expires_at timestamptz)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE phone_verifications
  SET attempts = attempts + 1
  WHERE id = p_verification_id
    AND attempts < 5
  RETURNING attempts, code, expires_at;
END;
$$;
