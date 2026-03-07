-- Store Stripe subscription period end so the UI can show renewal dates.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_end timestamptz NULL;
