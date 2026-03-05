import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FREE_WATCH_LIMIT = 1;

interface ProStatusContextType {
  isPro: boolean;
  loading: boolean;
  FREE_WATCH_LIMIT: number;
  subscriptionEnd: string | null;
  refreshProStatus: () => Promise<void>;
}

const ProStatusContext = createContext<ProStatusContextType>({
  isPro: false,
  loading: true,
  FREE_WATCH_LIMIT,
  subscriptionEnd: null,
  refreshProStatus: async () => {},
});

export const useProStatus = () => useContext(ProStatusContext);

export const ProStatusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionEnd] = useState<string | null>(null);

  const fetchProFromProfile = useCallback(async () => {
    if (!user) {
      setIsPro(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsPro(data?.is_pro ?? false);
    } catch (e) {
      console.error("Failed to read pro status:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on login/logout
  useEffect(() => {
    fetchProFromProfile();
  }, [fetchProFromProfile]);

  // Subscribe to realtime changes on the user's profile row
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`pro-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newPro = (payload.new as { is_pro?: boolean }).is_pro ?? false;
          setIsPro(newPro);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // refreshProStatus re-reads the profile (used after checkout redirect)
  const refreshProStatus = useCallback(async () => {
    await fetchProFromProfile();
  }, [fetchProFromProfile]);

  return (
    <ProStatusContext.Provider value={{ isPro, loading, FREE_WATCH_LIMIT, subscriptionEnd, refreshProStatus }}>
      {children}
    </ProStatusContext.Provider>
  );
};
