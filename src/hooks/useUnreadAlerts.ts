import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true if there are park alerts the user hasn't read yet.
 * Compares park_alerts count against user_alert_reads for the current user.
 */
export function useUnreadAlerts(): boolean {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUnread(false);
      return;
    }

    let cancelled = false;

    async function check() {
      const [{ count: totalAlerts }, { count: readAlerts }] = await Promise.all([
        supabase.from("park_alerts").select("id", { count: "exact", head: true }),
        supabase.from("user_alert_reads").select("alert_id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);

      if (!cancelled) {
        setHasUnread((totalAlerts ?? 0) > (readAlerts ?? 0));
      }
    }

    check();

    // Re-check every 5 minutes
    const interval = setInterval(check, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  return hasUnread;
}
