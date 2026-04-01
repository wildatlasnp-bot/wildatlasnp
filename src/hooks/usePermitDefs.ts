import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PermitDef } from "@/components/WatchCard";
import { ALL_PARK_IDS, getParkConfig } from "@/lib/parks";

export interface PermitDefWithPark extends PermitDef {
  park_id: string;
}

export interface ParkPermitGroup {
  parkId: string;
  parkName: string;
  permits: PermitDefWithPark[];
}

// Module-level cache for park_permits (rarely changes)
const PERMIT_DEFS_TTL_MS = 30 * 60 * 1000; // 30 minutes
let allPermitDefsCache: { data: PermitDefWithPark[]; fetchedAt: number } | null = null;

/**
 * Fetches and caches park permit definitions.
 * Returns defs, grouped by park, and a loading flag.
 */
export function usePermitDefs() {
  const [permitDefs, setPermitDefs] = useState<PermitDefWithPark[]>([]);
  const [defsLoaded, setDefsLoaded] = useState(false);
  const permitDefsRef = useRef<PermitDefWithPark[]>([]);

  useEffect(() => {
    permitDefsRef.current = permitDefs;
  }, [permitDefs]);

  useEffect(() => {
    const now = Date.now();
    if (allPermitDefsCache && now - allPermitDefsCache.fetchedAt < PERMIT_DEFS_TTL_MS) {
      setPermitDefs(allPermitDefsCache.data);
      setDefsLoaded(true);
      return;
    }

    supabase
      .from("park_permits")
      .select("name, description, season_start, season_end, total_finds, park_id, recgov_permit_id")
      .eq("is_active", true)
      .order("park_id")
      .then(({ data }) => {
        if (data) {
          const defs = data as PermitDefWithPark[];
          setPermitDefs(defs);
          allPermitDefsCache = { data: defs, fetchedAt: Date.now() };
        }
        setDefsLoaded(true);
      });
  }, []);

  /** Group permit defs by park in display order */
  const parkPermitGroups: ParkPermitGroup[] = ALL_PARK_IDS
    .map((parkId) => ({
      parkId,
      parkName: getParkConfig(parkId).shortName,
      permits: permitDefs.filter((p) => p.park_id === parkId),
    }))
    .filter((g) => g.permits.length > 0);

  return {
    permitDefs,
    permitDefsRef,
    defsLoaded,
    parkPermitGroups,
  };
}
