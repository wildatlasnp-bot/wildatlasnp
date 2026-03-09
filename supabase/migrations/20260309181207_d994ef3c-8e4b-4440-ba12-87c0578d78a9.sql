
CREATE TABLE public.account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  subscription_cancelled boolean NOT NULL DEFAULT false,
  deletion_type text NOT NULL DEFAULT 'scheduled',
  scheduled_deletion_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view deletion audit"
  ON public.account_deletion_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Block all client writes
CREATE POLICY "Block client writes to deletion audit"
  ON public.account_deletion_audit
  FOR ALL
  TO public
  USING (false);
