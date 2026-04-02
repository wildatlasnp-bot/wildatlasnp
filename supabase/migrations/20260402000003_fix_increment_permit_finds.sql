
-- Fix increment_permit_finds: remove the now-redundant recent_finds INSERT.
--
-- Background: this function originally used an INSERT into recent_finds
-- (ON CONFLICT DO NOTHING) as its own dedup gate, only incrementing
-- total_finds when the insert returned a new row.
--
-- After migration 20260305060532 added event_fingerprint, check-single-permit
-- was updated to INSERT into recent_finds first (as the atomic fingerprint
-- fence). That insert creates the (park_id, permit_name, found_date) row
-- before the RPC is ever called. The RPC's own INSERT then always conflicts,
-- _existing_id is always NULL, and total_finds is never incremented.
--
-- Fix: the dedup is already guaranteed by the fingerprint fence in
-- check-single-permit — if the fingerprint INSERT conflicts, the function
-- returns early and never calls this RPC. So the RPC should always
-- unconditionally increment the counter.
CREATE OR REPLACE FUNCTION public.increment_permit_finds(p_park_id text, p_permit_name text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.park_permits
  SET total_finds = total_finds + 1
  WHERE park_id = p_park_id AND name = p_permit_name;
END;
$$;
