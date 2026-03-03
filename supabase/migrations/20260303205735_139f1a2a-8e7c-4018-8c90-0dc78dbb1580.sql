
-- Add is_pro flag to profiles (defaults to false for free tier)
ALTER TABLE public.profiles ADD COLUMN is_pro boolean NOT NULL DEFAULT false;
