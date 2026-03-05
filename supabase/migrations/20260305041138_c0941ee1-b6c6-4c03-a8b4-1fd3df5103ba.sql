
CREATE OR REPLACE FUNCTION public.validate_phone_e164()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone_number IS NULL OR NEW.phone_number = '' THEN
    NEW.phone_number := NULL;
    RETURN NEW;
  END IF;

  IF NEW.phone_number !~ '^\+1[0-9]{10}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected E.164 US format: +1XXXXXXXXXX';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_phone_e164
  BEFORE INSERT OR UPDATE OF phone_number ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_phone_e164();
