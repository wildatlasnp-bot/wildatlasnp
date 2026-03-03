
-- Add phone_number to profiles
ALTER TABLE public.profiles ADD COLUMN phone_number text;

-- Index for quick lookup during SMS sends
CREATE INDEX idx_profiles_user_id ON public.profiles (user_id);
