
-- Cleanup function for notification_queue
CREATE OR REPLACE FUNCTION public.cleanup_notification_queue()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.notification_queue
  WHERE created_at < now() - interval '7 days';
  RETURN NEW;
END;
$$;

-- Fire on every insert, but only actually prune old rows
CREATE TRIGGER trg_cleanup_notification_queue
  AFTER INSERT ON public.notification_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_notification_queue();
