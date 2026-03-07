-- Index to support the Mochi rate-limit query:
--   SELECT COUNT(*) FROM api_health_log
--   WHERE endpoint = $1 AND created_at > $2
-- Without this, every Mochi message does a full table scan.
CREATE INDEX IF NOT EXISTS idx_api_health_log_endpoint_created_at
  ON api_health_log (endpoint, created_at DESC);
