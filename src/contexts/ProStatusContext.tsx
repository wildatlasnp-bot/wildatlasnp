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
  const { user, session } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user || !session) {
      setIsPro(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setIsPro(data?.subscribed ?? false);
      setSubscriptionEnd(data?.subscription_end ?? null);
    } catch (e) {
      console.error("check-subscription error:", e);
      const { data } = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsPro(data?.is_pro ?? false);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Re-check every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return (
    <ProStatusContext.Provider value={{ isPro, loading, FREE_WATCH_LIMIT, subscriptionEnd, refreshProStatus: checkSubscription }}>
      {children}
    </ProStatusContext.Provider>
  );
};
