ALTER TABLE public.profiles
ADD COLUMN notify_email boolean NOT NULL DEFAULT true,
ADD COLUMN notify_sms boolean NOT NULL DEFAULT false;