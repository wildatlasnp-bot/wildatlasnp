import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";
import type { PermitAvailability } from "./useSniperData";

/** RPC call with timeout */
async function rpcWithTimeout<T>(
  builder: { abortSignal: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: any }> },
  timeoutMs = 10_000
): Promise<{ data: T | null; error: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await builder.abortSignal(controller.signal);
    return result;
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { data: null, error: { message: "Request timed out" } };
    }
    return { data: null, error: { message: e?.message || "Unknown error" } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and maintains permit availability for all given parks.
 *
 * MED-1: Uses Supabase Realtime to subscribe to permit_availability changes
 * instead of a 2-minute polling interval, eliminating the thundering-herd
 * client polling problem.
 *
 * MED-3: Uses useRef(-1) for prevAvailCountRef instead of the
 * useState(() => ({ current: -1 }))[0] hack.
 */
export function usePermitAvailability(parkIds: string[]) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<PermitAvailability[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const lastCheckedRef = useRef<string | null>(null);
  const [scanPulse, setScanPulse] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // MED-3: useRef(-1) replaces the useState(() => ({ current: -1 }))[0] hack
  const prevAvailCountRef = useRef(-1);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const fetchAvailability = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await Promise.allSettled(
        parkIds.map((parkId) =>
          rpcWithTimeout(supabase.rpc("get_permit_availability", { p_park_code: parkId }))
        )
      );

      const allRows: PermitAvailability[] = [];
      let anyError = false;
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data) {
          allRows.push(...(result.value.data as unknown as PermitAvailability[]));
        } else {
          anyError = true;
        }
      }

      if (anyError && allRows.length === 0) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delayMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 16_000);
          if (import.meta.env.DEV) {
            console.log(`Retrying availability fetch (${retryCountRef.current}/${MAX_RETRIES}) in ${delayMs}ms`);
          }
          setTimeout(() => fetchAvailability(), delayMs);
          return;
        }
        toast({ title: "🐻 Trail hiccup", description: "Couldn't fetch availability. Using cached data." });
        retryCountRef.current = 0;
        return;
      }

      retryCountRef.current = 0;
      const prevCount = prevAvailCountRef.current;
      prevAvailCountRef.current = allRows.length;

      if (prevCount >= 0 && allRows.length > prevCount) {
        const newCount = allRows.length - prevCount;
        toast({
          title: "🎯 New availability detected!",
          description: `${newCount} new permit slot${newCount > 1 ? "s" : ""} just opened up.`,
        });
        posthog.capture("alert_received", { new_slots: newCount });
      }

      setAvailability(allRows);
      if (allRows.length > 0) {
        const latest = allRows.reduce((a, b) => a.last_checked > b.last_checked ? a : b);
        const changed = latest.last_checked !== lastCheckedRef.current;
        lastCheckedRef.current = latest.last_checked;
        setLastChecked(latest.last_checked);
        if (changed) {
          setScanPulse(true);
          setTimeout(() => setScanPulse(false), 1500);
        }
      } else {
        setLastChecked(null);
      }
    } finally {
      setRefreshing(false);
    }
  }, [parkIds, toast]);

  // Initial fetch + Realtime subscription (MED-1: replaces 2-minute polling).
  // Subscribe to all permit_availability changes; any write by the scanner
  // triggers a full refetch. Supabase Realtime doesn't support `in` filters,
  // so we subscribe without a park filter and handle all parks client-side.
  useEffect(() => {
    setInitialLoading(true);
    prevAvailCountRef.current = -1;

    fetchAvailability().finally(() => setInitialLoading(false));

    const channel = supabase
      .channel("permit-availability-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "permit_availability" },
        () => {
          fetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAvailability]);

  return {
    availability,
    lastChecked,
    scanPulse,
    refreshing,
    initialLoading,
    fetchAvailability,
  };
}
