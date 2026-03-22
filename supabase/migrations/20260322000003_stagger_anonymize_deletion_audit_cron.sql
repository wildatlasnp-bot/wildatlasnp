-- Stagger anonymize-deletion-audit-90d to 03:05 UTC to avoid
-- contention with purge-permit-availability-90d at 03:00 UTC.

SELECT cron.unschedule('anonymize-deletion-audit-90d');

SELECT cron.schedule(
  'anonymize-deletion-audit-90d',
  '5 3 * * *',
  'SELECT public.anonymize_old_deletion_audit()'
);
