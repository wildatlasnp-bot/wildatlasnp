ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS payment_status_since TIMESTAMPTZ;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_payment_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_payment_status_check
  CHECK (payment_status IN ('ok', 'past_due', 'canceled'));

CREATE OR REPLACE FUNCTION public.enforce_profile_protected_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

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
  NEW.payment_status := OLD.payment_status;
  NEW.payment_status_since := OLD.payment_status_since;

  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_profile_protected_fields();

CREATE FUNCTION public.get_profile_protected_fields()
 RETURNS TABLE(
   phone_verified boolean,
   stripe_customer_id text,
   onboarded_at timestamp with time zone,
   onboarding_step_reached integer,
   subscription_end timestamp with time zone,
   welcomed_at timestamp with time zone,
   is_pro boolean,
   payment_status text,
   payment_status_since timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.phone_verified, p.stripe_customer_id, p.onboarded_at,
         p.onboarding_step_reached, p.subscription_end, p.welcomed_at, p.is_pro,
         p.payment_status, p.payment_status_since
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE INDEX IF NOT EXISTS idx_profiles_payment_status_since
  ON public.profiles (payment_status_since)
  WHERE payment_status = 'past_due';