-- Block non-admin inserts
CREATE POLICY "Block non-admin inserts on user_roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Block non-admin updates
CREATE POLICY "Block non-admin updates on user_roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Block non-admin deletes
CREATE POLICY "Block non-admin deletes on user_roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));