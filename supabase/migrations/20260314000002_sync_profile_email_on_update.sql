-- Keep profiles.email in sync when a user changes their email in Supabase Auth.
--
-- The existing profiles_sync_email_on_insert trigger fires BEFORE INSERT on
-- public.profiles, copying auth.users.email into the new profile row at
-- creation time. It does not fire on subsequent auth email changes, so
-- profiles.email drifts out of sync — breaking the stripe-webhook indexed
-- lookup (profiles WHERE email = ?) for users who have changed their email.
--
-- Fix: add an AFTER UPDATE trigger on auth.users that fires when the email
-- column changes and propagates the new value to public.profiles.
-- AFTER (not BEFORE) because we want the auth row committed before touching
-- the dependent public row. FOR EACH ROW + WHEN guard ensures we only run
-- when email actually changed (not on unrelated profile updates).

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id
    AND email IS DISTINCT FROM NEW.email;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auth_users_sync_profile_email ON auth.users;
CREATE TRIGGER auth_users_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email_from_auth();
