-- Add orphaned_at tracking to scan_targets
ALTER TABLE public.scan_targets
ADD COLUMN orphaned_at timestamp with time zone NULL;

COMMENT ON COLUMN public.scan_targets.orphaned_at IS 'Timestamp when this target first had zero active watchers. Cleared when a watcher is added.';

-- Create index for efficient orphaned target queries
CREATE INDEX idx_scan_targets_orphaned_cleanup
ON public.scan_targets (orphaned_at)
WHERE status = 'active' AND orphaned_at IS NOT NULL;