import { createContext, useContext, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthContextType } from "./auth/types";
import { useProfileManager } from "./auth/useProfileManager";
import { useSessionManager } from "./auth/useSessionManager";

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  displayName: null,
  scheduledDeletionAt: null,
  welcomed: false,
  loading: true,
  ready: false,
  needsOnboarding: false,
  onboardingStep: 0,
  signOut: async () => {},
  clearDeletionSchedule: () => {},
  refreshProfile: async () => {},
  markOnboardingComplete: () => {},
  markWelcomed: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const profile = useProfileManager();

  const sessionCallbacks = useMemo(
    () => ({
      onConfirmedUser: (user: { id: string }) => {
        profile.beginProfileResolution(user.id);
      },
      onNoUser: () => {
        profile.resetProfile();
      },
    }),
    // These refs are stable across renders — safe to list once
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.beginProfileResolution, profile.resetProfile]
  );

  const { user, session, loading } = useSessionManager(sessionCallbacks);

  const signOut = useCallback(async () => {
    profile.clearOnboardingFlag();
    await supabase.auth.signOut();
  }, [profile.clearOnboardingFlag]);

  const refreshProfile = useCallback(async () => {
    if (user) await profile.fetchProfile(user.id, true);
  }, [user, profile.fetchProfile]);

  const markWelcomed = useCallback(() => {
    profile.markWelcomed(user?.id);
  }, [user?.id, profile.markWelcomed]);

  const ready = !loading && (!user || profile.profileResolved);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      displayName: profile.displayName,
      scheduledDeletionAt: profile.scheduledDeletionAt,
      welcomed: profile.welcomed,
      loading,
      ready,
      needsOnboarding: profile.needsOnboarding,
      onboardingStep: profile.onboardingStep,
      signOut,
      clearDeletionSchedule: profile.clearDeletionSchedule,
      refreshProfile,
      markOnboardingComplete: profile.markOnboardingComplete,
      markWelcomed,
    }),
    [
      user,
      session,
      profile.displayName,
      profile.scheduledDeletionAt,
      profile.welcomed,
      loading,
      ready,
      profile.needsOnboarding,
      profile.onboardingStep,
      signOut,
      profile.clearDeletionSchedule,
      refreshProfile,
      profile.markOnboardingComplete,
      markWelcomed,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
