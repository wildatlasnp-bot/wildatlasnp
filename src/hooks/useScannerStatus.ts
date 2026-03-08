import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveScannerState, formatTimeAgo, type ScannerState } from "@/lib/scanner-status";

/**
 * Centralized scanner status hook — single source of truth.
 * Every component that needs scanner state must use this hook.
 */
export function useScannerStatus() {
  const [lastSuccessfulScanAt, setLastSuccessfulScanAt] = useState<string | null>(null);
  const [heartbeatError, setHeartbeatError] = useState(false);

  const checkHeartbeat = useCallback(async () => {
    const { data, error } = await supabase
      .from("permit_cache")
      .select("fetched_at")
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
  }, []);

  useEffect(() => {
    checkHeartbeat();
    const interval = setInterval(checkHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [checkHeartbeat]);

  const scannerState: ScannerState = deriveScannerState(lastSuccessfulScanAt, heartbeatError);
  const isStale = scannerState === "delayed";

  const getTimeAgo = useCallback((dateStr: string) => formatTimeAgo(dateStr), []);

  return {
    scannerState,
    lastSuccessfulScanAt,
    isStale,
    getTimeAgo,
    refreshHeartbeat: checkHeartbeat,
  };
}
