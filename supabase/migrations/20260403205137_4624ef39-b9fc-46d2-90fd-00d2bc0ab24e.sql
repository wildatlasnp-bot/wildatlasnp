
-- Step 1: Deduplicate existing rows, keeping the most recently verified entry per phone number
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY phone_number
      ORDER BY phone_verified DESC, updated_at DESC
    ) AS rn
  FROM public.profiles
  WHERE phone_number IS NOT NULL
)
UPDATE public.profiles
SET phone_number = NULL,
    phone_verified = FALSE,
    notify_sms = FALSE
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Step 2: Add unique constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);
