-- Schedule the existing prune_mochi_rate_limits() function.
-- Runs every 15 minutes; the function deletes rows older than 1 hour,
-- keeping the table bounded under normal usage (~20 inserts/user/day).

SELECT cron.schedule(
  'prune-mochi-rate-limits',
  '*/15 * * * *',
  $$SELECT prune_mochi_rate_limits()$$
);
