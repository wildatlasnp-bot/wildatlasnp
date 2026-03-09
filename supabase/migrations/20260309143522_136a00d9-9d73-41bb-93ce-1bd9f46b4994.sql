
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_step_reached integer NOT NULL DEFAULT 0;
