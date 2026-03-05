-- Allow authenticated users to read the scanner heartbeat sentinel row
CREATE POLICY "Users can view scanner heartbeat"
ON public.permit_cache
FOR SELECT
TO authenticated
USING (cache_key = '__scanner_heartbeat__');