import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  scheduledDeletionAt: string | null;
  /** True while auth session is being restored */
  loading: boolean;
  /** True once auth + profile + onboarding state are all resolved */
  ready: boolean;
  /** True if user is authenticated but has NOT completed onboarding */
  needsOnboarding: boolean;
  /** The furthest onboarding step the user reached (for resume) */
  onboardingStep: number;
  signOut: () => Promise<void>;
  clearDeletionSchedule: () => void;
  refreshProfile: () => Promise<void>;
  /** Call when onboarding completes to update context + localStorage */
  markOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  displayName: null,
  scheduledDeletionAt: null,
  loading: true,
  ready: false,
  needsOnboarding: false,
  onboardingStep: 0,
  signOut: async () => {},
  clearDeletionSchedule: () => {},
  refreshProfile: async () => {},
  markOnboardingComplete: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile + onboarding gate state
  const [profileResolved, setProfileResolved] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Sticky flag: once onboarding is confirmed complete, never re-check
  const onboardingCompleteRef = useRef(
    localStorage.getItem("wildatlas_onboarded") === "true"
  );

  // Track which user ID we've resolved profile for
  const resolvedUserIdRef = useRef<string | null>(null);
  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, force = false) => {
    // Guard: userId must be non-empty (prevents accidental calls on logout)
    if (!userId) return;

    // Deduplicate: skip if already fetching for this user (unless forced)
    if (!force && fetchingRef.current === userId) return;
    fetchingRef.current = userId;

    // IMPORTANT: Do NOT reset profileResolved here. Keep stale data visible
    // during refetch to prevent routing flashes.

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, scheduled_deletion_at, onboarded_at, onboarding_step_reached")
      .eq("user_id", userId)
      .maybeSingle();

    // Stale-response guard: fetchingRef is set to the current user's id at fetch start
    // and reset to null on logout. If it no longer matches the userId we fetched for,
    // either logout happened or a new user logged in while we were awaiting — discard.
    if (fetchingRef.current !== userId) {
      return;
    }

    // On error, keep current state — don't redirect
    if (error) {
      console.warn("[auth] profile fetch error, keeping current state", error);
      resolvedUserIdRef.current = userId;
      setProfileResolved(true);
      return;
    }

    if (!data) {
      // Missing profile — auto-create
      console.warn("[auth] no profile found, creating one");
      await supabase.from("profiles").insert({ user_id: userId });
      setDisplayName(null);
      setScheduledDeletionAt(null);
      if (!onboardingCompleteRef.current) {
        setNeedsOnboarding(true);
        setOnboardingStep(0);
      }
      resolvedUserIdRef.current = userId;
      setProfileResolved(true);
      return;
    }

    setDisplayName(data.display_name ?? null);
    setScheduledDeletionAt((data as any)?.scheduled_deletion_at ?? null);

    // Resolve onboarding — but only if not already confirmed complete (sticky)
    if (!onboardingCompleteRef.current) {
      const completed = !!data.onboarded_at;
      if (completed) {
        localStorage.setItem("wildatlas_onboarded", "true");
        onboardingCompleteRef.current = true;
        setNeedsOnboarding(false);
      } else {
        setOnboardingStep(data.onboarding_step_reached ?? 0);
        setNeedsOnboarding(true);
      }
    } else {
      // Onboarding already confirmed complete — never flip back
      setNeedsOnboarding(false);
    }

    resolvedUserIdRef.current = userId;
    setProfileResolved(true);
  };

  const clearDeletionSchedule = () => setScheduledDeletionAt(null);

  const markOnboardingComplete = () => {
    localStorage.setItem("wildatlas_onboarded", "true");
    onboardingCompleteRef.current = true;
    setNeedsOnboarding(false);
  };

  // Helper: only treat user as authenticated if email is confirmed
  const isConfirmed = (u: User | null) =>
    !!u?.email_confirmed_at || !!u?.confirmed_at;

  /** Shared handler for applying a session (used by both getSession and onAuthStateChange) */
  const applySession = (sess: Session | null, source: string) => {
    const confirmedUser = sess?.user && isConfirmed(sess.user) ? sess.user : null;
    console.log(`[auth] applySession(${source}): session=${!!sess}, confirmed=${!!confirmedUser}, userId=${confirmedUser?.id?.slice(0, 8) ?? 'none'}`);
    setSession(confirmedUser ? sess : null);
    setUser(confirmedUser);

    if (confirmedUser) {
      // Same user as already resolved — don't reset profile gate.
      // This prevents token-refresh events from causing routing flashes.
      if (resolvedUserIdRef.current === confirmedUser.id) {
        // Profile already resolved for this user. Optionally refresh in
        // the background, but keep profileResolved = true so `ready` stays true.
        return;
      }
      // Different user (or first load) — need to fetch profile
      fetchingRef.current = null;
      if (!onboardingCompleteRef.current) {
        setProfileResolved(false);
      }
      resolvedUserIdRef.current = null;
      setTimeout(() => fetchProfile(confirmedUser.id), 0);
    } else {
      console.log(`[auth] applySession(${source}): clearing user state, sess.user exists=${!!sess?.user}, confirmed_at=${sess?.user?.confirmed_at}, email_confirmed_at=${sess?.user?.email_confirmed_at}`);
      setDisplayName(null);
      setScheduledDeletionAt(null);
      fetchingRef.current = null;
      resolvedUserIdRef.current = null;
      setProfileResolved(true);
      setNeedsOnboarding(false);
      onboardingCompleteRef.current = localStorage.getItem("wildatlas_onboarded") === "true";
    }
  };

  useEffect(() => {
    // Track whether the initial session has been restored from storage.
    let initialSessionRestored = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ignore events before getSession() has restored the persisted session
      if (!initialSessionRestored) return;
      applySession(session);
      setLoading(false);
    });

    // Restore persisted session FIRST, then allow onAuthStateChange to proceed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setLoading(false);
      initialSessionRestored = true;
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    // Keep profileResolved = true during refetch (stale-while-revalidate)
    if (user) await fetchProfile(user.id, true);
  };

  const signOut = async () => {
    localStorage.removeItem("wildatlas_onboarded");
    onboardingCompleteRef.current = false;
    await supabase.auth.signOut();
  };

  // ready = auth resolved AND (no user OR profile resolved for current user)
  const ready = !loading && (!user || profileResolved);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      displayName,
      scheduledDeletionAt,
      loading,
      ready,
      needsOnboarding,
      onboardingStep,
      signOut,
      clearDeletionSchedule,
      refreshProfile,
      markOnboardingComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
