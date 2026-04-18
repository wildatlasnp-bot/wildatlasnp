-- Fix privilege escalation: the 1-arg overload of get_profile_protected_fields
-- is SECURITY DEFINER and was EXECUTE-able by `authenticated`/`anon`, allowing
-- any signed-in user to read protected fields (stripe_customer_id, is_pro,
-- subscription_end, etc.) for ANY user by passing their UUID.
-- The overload is unused in application code; drop it and re-lock the
-- parameterless version so only authenticated users can call it.

DROP FUNCTION IF EXISTS public.get_profile_protected_fields(uuid);

REVOKE EXECUTE ON FUNCTION public.get_profile_protected_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_protected_fields() TO authenticated, service_role;