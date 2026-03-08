import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RecentFind {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
  location_name: string;
  available_dates?: string[];
}

export interface RecentFindsData {
  /** All recent finds (up to 10, newest first) */
  finds: RecentFind[];
  /** Count of finds in last 24h */
  todayCount: number;
  /** Most recent found_at timestamp */
  lastFound: string | null;
  /** Most frequently found permit in last 7 days */
  topPermit: string | null;
  /** Map of permit_name → most recent found_at */
  lastFindByPermit: Record<string, string>;
  /** IDs that arrived via realtime during this session (for entrance animation) */
  newIds: Set<string>;
  loading: boolean;
}

/**
 * Shared hook that consolidates all recent_finds queries into a single fetch.
 * When parkId is omitted, fetches across all parks.
 */
export function useRecentFinds(parkId?: string) {
  const [data, setData] = useState<RecentFindsData>({
    finds: [],
    todayCount: 0,
    lastFound: null,
    topPermit: null,
    lastFindByPermit: {},
    newIds: new Set(),
    loading: true,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchFinds = useCallback(async () => {
    let query = supabase
      .from("recent_finds")
      .select("id, park_id, permit_name, found_at, location_name, available_dates")
      .order("found_at", { ascending: false })
      .limit(50);

    if (parkId) {
      query = query.eq("park_id", parkId);
    }

    const { data: rows } = await query;

    if (!mountedRef.current) return;
    if (!rows) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const finds = rows as RecentFind[];
    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - 7 * 86400000;

    const todayCount = finds.filter(f => new Date(f.found_at).getTime() >= dayAgo).length;
    const lastFound = finds.length > 0 ? finds[0].found_at : null;

    const weekFinds = finds.filter(f => new Date(f.found_at).getTime() >= weekAgo);
    let topPermit: string | null = null;
    if (weekFinds.length > 0) {
      const counts: Record<string, number> = {};
      for (const r of weekFinds) {
        counts[r.permit_name] = (counts[r.permit_name] || 0) + 1;
      }
      topPermit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }

    const lastFindByPermit: Record<string, string> = {};
    for (const row of finds) {
      if (!lastFindByPermit[row.permit_name]) {
        lastFindByPermit[row.permit_name] = row.found_at;
      }
    }

    setData(prev => ({
      finds: finds.slice(0, 10),
      todayCount,
      lastFound,
      topPermit,
      lastFindByPermit,
      newIds: prev.newIds,
      loading: false,
    }));
  }, [parkId]);

  useEffect(() => {
    fetchFinds();
  }, [fetchFinds]);

  // Realtime: listen for new inserts
  useEffect(() => {
    const channel = supabase
      .channel("recent-finds-shared")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "recent_finds",
      }, (payload) => {
        if (!mountedRef.current) return;
        const newFind = payload.new as RecentFind;
        if (parkId && newFind.park_id !== parkId) return;

        setData(prev => {
          const finds = [newFind, ...prev.finds].slice(0, 10);
          const now = Date.now();
          const dayAgo = now - 86400000;
          const newIds = new Set(prev.newIds);
          newIds.add(newFind.id);

          return {
            ...prev,
            finds,
            todayCount: prev.todayCount + (new Date(newFind.found_at).getTime() >= dayAgo ? 1 : 0),
            lastFound: newFind.found_at,
            newIds,
            lastFindByPermit: {
              ...prev.lastFindByPermit,
              [newFind.permit_name]: newFind.found_at,
            },
          };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [parkId]);

  return data;
}
