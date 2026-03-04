
CREATE OR REPLACE FUNCTION public.cleanup_permit_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.permit_availability
  WHERE date < CURRENT_DATE - interval '7 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_permit_availability
AFTER INSERT ON public.permit_availability
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_permit_availability();
