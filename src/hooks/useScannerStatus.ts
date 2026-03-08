import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveScannerState, formatTimeAgo, type ScannerState } from "@/lib/scanner-status";

/**
 * Centralized scanner status hook — single source of truth.
 * Every component that needs scanner state must use this hook.
 *
 * MED-7: Also reads `available` and `error_count` from the heartbeat row so
 * the health dashboard correctly detects when all workers failed (not just
 * when the heartbeat is stale).
 */
export function useScannerStatus() {
  const [lastSuccessfulScanAt, setLastSuccessfulScanAt] = useState<string | null>(null);
  const [heartbeatError, setHeartbeatError] = useState(false);
  const [workerErrorCount, setWorkerErrorCount] = useState(0);
  const [allWorkersFailed, setAllWorkersFailed] = useState(false);

  const checkHeartbeat = useCallback(async () => {
    const { data, error } = await supabase
      .from("permit_cache")
      .select("fetched_at, available, error_count")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle();

    if (error || !data) {
      setHeartbeatError(!data && !error ? false : !!error);
      if (!data && !error) {
        // No heartbeat row yet — starting state
        setLastSuccessfulScanAt(null);
      }
      return;
    }

    setHeartbeatError(false);
    setLastSuccessfulScanAt(data.fetched_at);
    setWorkerErrorCount(data.error_count ?? 0);
    setAllWorkersFailed(data.available === false);
  }, []);

  useEffect(() => {
    checkHeartbeat();
    const interval = setInterval(checkHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [checkHeartbeat]);

  // If all workers failed, treat it as an error state even if heartbeat is fresh
  const effectiveHeartbeatError = heartbeatError || allWorkersFailed;
  const scannerState: ScannerState = deriveScannerState(lastSuccessfulScanAt, effectiveHeartbeatError);
  const isStale = scannerState === "delayed";

  const getTimeAgo = useCallback((dateStr: string) => formatTimeAgo(dateStr), []);

  return {
    scannerState,
    lastSuccessfulScanAt,
    isStale,
    workerErrorCount,
    allWorkersFailed,
    getTimeAgo,
    refreshHeartbeat: checkHeartbeat,
  };
}
