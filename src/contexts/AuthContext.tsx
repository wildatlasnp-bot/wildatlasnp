import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  scheduledDeletionAt: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  clearDeletionSchedule: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  displayName: null,
  scheduledDeletionAt: null,
  loading: true,
  signOut: async () => {},
  clearDeletionSchedule: () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, force = false) => {
    // Deduplicate: skip if already fetching for this user (unless forced)
    if (!force && fetchingRef.current === userId) return;
    fetchingRef.current = userId;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, scheduled_deletion_at")
      .eq("user_id", userId)
      .maybeSingle();
    setDisplayName(data?.display_name ?? null);
    setScheduledDeletionAt((data as any)?.scheduled_deletion_at ?? null);
  };

  const clearDeletionSchedule = () => setScheduledDeletionAt(null);

  // Helper: only treat user as authenticated if email is confirmed
  const isConfirmed = (u: User | null) =>
    !!u?.email_confirmed_at || !!u?.confirmed_at;

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const confirmedUser = session?.user && isConfirmed(session.user) ? session.user : null;
      setSession(confirmedUser ? session : null);
      setUser(confirmedUser);
      if (confirmedUser) {
        setTimeout(() => fetchProfile(confirmedUser.id), 0);
      } else {
        setDisplayName(null);
        setScheduledDeletionAt(null);
        fetchingRef.current = null;
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, displayName, scheduledDeletionAt, loading, signOut, clearDeletionSchedule, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
