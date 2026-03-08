-- Add email column to profiles to avoid N+1 auth.admin.getUserById calls
-- in fan-out-notifications and retry-notifications edge functions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Trigger: sync email from auth.users on new profile insert
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_email_on_insert ON public.profiles;
CREATE TRIGGER profiles_sync_email_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Backfill email for all existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email IS NULL;
