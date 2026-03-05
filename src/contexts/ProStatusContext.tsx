import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FREE_WATCH_LIMIT = 1;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BASE_POLL_MS = 5 * 60 * 1000; // 5 minutes (matches cache TTL)
const MAX_POLL_MS = 30 * 60 * 1000; // 30 minutes max backoff

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
  const lastCheckedRef = useRef<number>(0);
  const inflightRef = useRef<Promise<void> | null>(null);
  const failCountRef = useRef<number>(0);
  // Stable ref for user so callback doesn't re-create on auth state settling
  const userRef = useRef(user);
  const sessionRef = useRef(session);
  userRef.current = user;
  sessionRef.current = session;

  const checkSubscription = useCallback(async (force = false) => {
    const currentUser = userRef.current;
    const currentSession = sessionRef.current;

    if (!currentUser || !currentSession) {
      setIsPro(false);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (!force && now - lastCheckedRef.current < CACHE_TTL_MS) {
      setLoading(false);
      return;
    }

    if (inflightRef.current) {
      await inflightRef.current;
      return;
    }

    const doCheck = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) throw error;
        setIsPro(data?.subscribed ?? false);
        setSubscriptionEnd(data?.subscription_end ?? null);
        lastCheckedRef.current = Date.now();
        failCountRef.current = 0; // reset backoff on success
      } catch (e) {
        console.error("check-subscription error:", e);
        failCountRef.current = Math.min(failCountRef.current + 1, 5); // cap at 5
        const { data } = await supabase
          .from("profiles")
          .select("is_pro")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        setIsPro(data?.is_pro ?? false);
        lastCheckedRef.current = Date.now();
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    };

    inflightRef.current = doCheck();
    await inflightRef.current;
  }, []); // stable - no deps, uses refs

  // Trigger check when user logs in (user goes from null → object)
  useEffect(() => {
    if (user && session) {
      checkSubscription();
    } else {
      setIsPro(false);
      setLoading(false);
    }
  }, [!!user, !!session]); // only re-run on login/logout, not identity changes

  // Re-check periodically with exponential backoff on failures
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = Math.min(BASE_POLL_MS * Math.pow(2, failCountRef.current), MAX_POLL_MS);
      timer = setTimeout(async () => {
        await checkSubscription(true);
        schedule(); // reschedule with potentially updated backoff
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [user, checkSubscription]);

  const refreshProStatus = useCallback(async () => {
    await checkSubscription(true);
  }, [checkSubscription]);

  return (
    <ProStatusContext.Provider value={{ isPro, loading, FREE_WATCH_LIMIT, subscriptionEnd, refreshProStatus }}>
      {children}
    </ProStatusContext.Provider>
  );
};
