import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns whether there are unread park alerts and a function to mark all as read.
 */
export function useUnreadAlerts(): { hasUnread: boolean; markAllRead: () => void } {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const checkRef = useRef<() => Promise<void>>();

  const check = useCallback(async () => {
    if (!user) return;
    const [{ count: totalAlerts }, { count: readAlerts }] = await Promise.all([
      supabase.from("park_alerts").select("id", { count: "exact", head: true }),
      supabase.from("user_alert_reads").select("alert_id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setHasUnread((totalAlerts ?? 0) > (readAlerts ?? 0));
  }, [user]);

  checkRef.current = check;

  useEffect(() => {
    if (!user) { setHasUnread(false); return; }
    check();
    const interval = setInterval(check, 5 * 60_000);
    return () => clearInterval(interval);
  }, [user, check]);

  const markingRef = useRef(false);

  const markAllRead = useCallback(async () => {
    if (!user || markingRef.current) return;
    markingRef.current = true;
    try {
      const { data: allAlerts } = await supabase.from("park_alerts").select("id");
      const { data: reads } = await supabase.from("user_alert_reads").select("alert_id").eq("user_id", user.id);
      if (!allAlerts) return;

      const readSet = new Set((reads ?? []).map((r) => r.alert_id));
      const unread = allAlerts.filter((a) => !readSet.has(a.id));
      if (unread.length === 0) { setHasUnread(false); return; }

      const rows = unread.map((a) => ({
        user_id: user.id,
        alert_id: a.id,
        read_at: new Date().toISOString(),
      }));

      await supabase.from("user_alert_reads").upsert(rows, {
        onConflict: "user_id,alert_id",
        ignoreDuplicates: true,
      });

      setHasUnread(false);
    } finally {
      markingRef.current = false;
    }
  }, [user]);

  return { hasUnread, markAllRead };
}
