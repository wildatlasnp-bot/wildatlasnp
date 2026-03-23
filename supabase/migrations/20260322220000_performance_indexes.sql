-- Performance indexes: active watcher filter + park_permits composite lookup
-- See audit: no conflicting indexes exist on either target table.

-- Partial index: only indexes active watchers.
-- Eliminates sequential scan on scanner heartbeat queries that filter WHERE is_active = true.
CREATE INDEX IF NOT EXISTS idx_user_watchers_active_filter
  ON public.user_watchers (is_active)
  WHERE is_active = true;

-- Composite covering index for permit-to-park mapping.
-- Enables index-only scans on park_permits lookups filtering by (park_id, name).
CREATE INDEX IF NOT EXISTS idx_park_permits_lookup_composite
  ON public.park_permits (park_id, name);
