-- Index on profiles.stripe_customer_id for Stripe customer lookups.
-- Used by create-checkout (customer deduplication) and stripe-webhook
-- (subscription state sync). Partial index excludes NULL rows, which
-- represent users who have never started a checkout session.

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
