-- Index on profiles.email for O(1) email → user_id lookups.
-- Used by stripe-webhook resolveUser() and customer.created handler to
-- replace auth.admin.listUsers() full scans (which only fetched page 1,
-- silently failing at >1000 users).
-- Partial index excludes NULL rows (profiles that predate the backfill
-- or have no associated email address).

CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles (email)
  WHERE email IS NOT NULL;
