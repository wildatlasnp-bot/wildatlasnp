
CREATE OR REPLACE FUNCTION public.cleanup_notification_log()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.notification_log
  WHERE created_at < now() - interval '30 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_notification_log
  AFTER INSERT ON public.notification_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_notification_log();
