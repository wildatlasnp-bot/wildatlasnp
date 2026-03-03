
CREATE TABLE public.pro_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  signup_date timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.pro_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own waitlist entry"
ON public.pro_waitlist FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own waitlist entry"
ON public.pro_waitlist FOR SELECT TO authenticated
USING (auth.uid() = user_id);
