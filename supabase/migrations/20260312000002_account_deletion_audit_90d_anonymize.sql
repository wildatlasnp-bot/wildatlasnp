-- Retention policy: account_deletion_audit, PII anonymization (90 days).
--
-- This table records that an account deletion occurred, when, and whether a
-- subscription was cancelled. The audit fact has indefinite compliance value.
-- user_email is direct PII and must not be retained indefinitely for deleted
-- accounts (GDPR right-to-erasure).
--
-- Strategy: anonymize user_email after 90 days rather than deleting the row.
-- 90 days covers Stripe's card dispute window (120 days is max, but disputes
-- on subscription charges are typically raised within 60-90 days). The audit
-- fact (deletion happened, subscription_cancelled, scheduled_deletion_at)
-- remains intact for billing and compliance review.
--
-- user_id is left as-is: after purge-deleted-accounts runs, it is an orphaned
-- UUID with no corresponding auth.users row and cannot be re-linked to a person.
--
-- pg_cron chosen: this table receives at most one row per account deletion
-- event. Write frequency is very low; a scheduled job is appropriate.
-- Scheduled: daily at 03:00 UTC (offset from email_logs cleanup at 02:00).

-- Support efficient range-update predicate
CREATE INDEX IF NOT EXISTS idx_account_deletion_audit_created_at
  ON public.account_deletion_audit (created_at);

CREATE OR REPLACE FUNCTION public.anonymize_old_deletion_audit()
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Redact user_email after 90 days. user_id is retained as an orphaned UUID.
  -- The audit fact (when, type, subscription_cancelled) is preserved.
  UPDATE public.account_deletion_audit
  SET user_email = '[redacted]'
  WHERE created_at < now() - interval '90 days'
    AND user_email <> '[redacted]';
END;
$$;

SELECT cron.schedule(
  'anonymize-deletion-audit-90d',
  '0 3 * * *',
  'SELECT public.anonymize_old_deletion_audit()'
);
