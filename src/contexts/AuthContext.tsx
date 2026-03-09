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

  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, force = false) => {
    // Deduplicate: skip if already fetching for this user (unless forced)
    if (!force && fetchingRef.current === userId) return;
    fetchingRef.current = userId;

    console.log("[🔍 AUTH-DIAG] fetchProfile called", { userId, force, onboardingCompleteRef: onboardingCompleteRef.current, profileResolved });

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, scheduled_deletion_at, onboarded_at, onboarding_step_reached")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[🔍 AUTH-DIAG] fetchProfile result", { data: data ? { onboarded_at: data.onboarded_at, step: data.onboarding_step_reached, display_name: data.display_name } : null, error: error?.message ?? null });

    // On error, keep current state — don't redirect
    if (error) {
      console.warn("[🔍 AUTH-DIAG] profile fetch error, keeping current state", error);
      if (!profileResolved) setProfileResolved(true);
      return;
    }

    if (!data) {
      console.warn("[🔍 AUTH-DIAG] no profile found, creating one");
      await supabase.from("profiles").insert({ user_id: userId });
      setDisplayName(null);
      setScheduledDeletionAt(null);
      if (!onboardingCompleteRef.current) {
        setNeedsOnboarding(true);
        setOnboardingStep(0);
      }
      setProfileResolved(true);
      return;
    }

    setDisplayName(data.display_name ?? null);
    setScheduledDeletionAt((data as any)?.scheduled_deletion_at ?? null);

    // Resolve onboarding — but only if not already confirmed complete
    if (!onboardingCompleteRef.current) {
      const completed = !!data.onboarded_at;
      console.log("[🔍 AUTH-DIAG] onboarding check", { completed, onboarded_at: data.onboarded_at });
      if (completed) {
        localStorage.setItem("wildatlas_onboarded", "true");
        onboardingCompleteRef.current = true;
        setNeedsOnboarding(false);
      } else {
        setOnboardingStep(data.onboarding_step_reached ?? 0);
        setNeedsOnboarding(true);
      }
    } else {
      console.log("[🔍 AUTH-DIAG] onboarding already confirmed complete, skipping check");
      setNeedsOnboarding(false);
    }

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

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const confirmedUser = session?.user && isConfirmed(session.user) ? session.user : null;
      setSession(confirmedUser ? session : null);
      setUser(confirmedUser);
      if (confirmedUser) {
        // Fetch profile async — don't block auth state change
        setTimeout(() => fetchProfile(confirmedUser.id), 0);
      } else {
        setDisplayName(null);
        setScheduledDeletionAt(null);
        fetchingRef.current = null;
        // No user = no profile to resolve, but mark as resolved
        setProfileResolved(true);
        setNeedsOnboarding(false);
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

  // ready = auth resolved AND (no user OR profile resolved)
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
