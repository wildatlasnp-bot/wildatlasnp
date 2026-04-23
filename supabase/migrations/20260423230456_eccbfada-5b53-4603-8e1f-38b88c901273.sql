-- ============================================================
-- FIX 1: Add RLS policies on storage.objects
-- ============================================================
-- The 'email-assets' bucket is public for reads (intentional, used in
-- transactional emails), but there are no policies restricting writes.
-- Lock down all write operations to service_role only.

-- Public read access for email-assets bucket only
DROP POLICY IF EXISTS "Public read access for email-assets" ON storage.objects;
CREATE POLICY "Public read access for email-assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'email-assets');

-- Restrict all writes (insert/update/delete) to service_role
DROP POLICY IF EXISTS "Service role can insert objects" ON storage.objects;
CREATE POLICY "Service role can insert objects"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update objects" ON storage.objects;
CREATE POLICY "Service role can update objects"
ON storage.objects
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete objects" ON storage.objects;
CREATE POLICY "Service role can delete objects"
ON storage.objects
FOR DELETE
TO public
USING (auth.role() = 'service_role');


-- ============================================================
-- FIX 2: Replace complex profiles UPDATE policy with a BEFORE UPDATE trigger
-- ============================================================
-- The existing UPDATE policy uses get_profile_protected_fields() with multiple
-- subquery comparisons that could behave unexpectedly on race conditions.
-- A BEFORE UPDATE trigger is simpler and more robust.

-- Trigger function: enforces that protected fields cannot be modified by users.
-- Service role bypasses RLS entirely, so this only affects authenticated user updates.
CREATE OR REPLACE FUNCTION public.enforce_profile_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses this check (it's only invoked under RLS context anyway,
  -- but defense in depth: allow service_role to make any change)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Reset any attempted change to a protected field back to its prior value.
  -- This silently ignores tampering attempts rather than raising, which avoids
  -- breaking legitimate updates that accidentally include unchanged protected fields.
  NEW.is_pro := OLD.is_pro;
  NEW.phone_verified := OLD.phone_verified;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.subscription_end := OLD.subscription_end;
  NEW.onboarded_at := OLD.onboarded_at;
  NEW.onboarding_step_reached := GREATEST(OLD.onboarding_step_reached, NEW.onboarding_step_reached);
  NEW.welcomed_at := OLD.welcomed_at;
  NEW.scheduled_deletion_at := OLD.scheduled_deletion_at;
  NEW.sms_consent_at := COALESCE(OLD.sms_consent_at, NEW.sms_consent_at);
  NEW.sms_consent_version := COALESCE(OLD.sms_consent_version, NEW.sms_consent_version);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_protected_fields ON public.profiles;
CREATE TRIGGER trg_enforce_profile_protected_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_protected_fields();

-- Now we can simplify the UPDATE policy to just check ownership.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
