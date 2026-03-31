import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMochiStats() {
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    supabase
      .from("permit_cache")
      .select("*", { count: "exact", head: true })
      .gte("fetched_at", startOfMonth.toISOString())
      .then(({ count, error }) => {
        if (!error && count !== null) setScanCount(count);
        setLoading(false);
      });
  }, []);

  return { scanCount, loading };
}
