-- permit_availability rows older than 90 days are purged automatically.
-- Primary cleanup is the insert-triggered function (7-day retention on `date`).
-- This pg_cron job is a safety net: it catches rows that escaped the trigger
-- during periods of scanner inactivity (no inserts = trigger never fires).

CREATE OR REPLACE FUNCTION public.purge_old_permit_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- permit_availability rows older than 90 days are purged automatically.
  DELETE FROM public.permit_availability
  WHERE date < CURRENT_DATE - interval '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE LOG 'purge_old_permit_availability: deleted % row(s) with date < % - 90 days',
    deleted_count, CURRENT_DATE;
END;
$$;

-- Run daily at 03:00 UTC. The unschedule guard makes this migration idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-permit-availability-90d') THEN
    PERFORM cron.unschedule('purge-permit-availability-90d');
  END IF;
END;
$$;

SELECT cron.schedule(
  'purge-permit-availability-90d',
  '0 3 * * *',
  'SELECT public.purge_old_permit_availability()'
);
