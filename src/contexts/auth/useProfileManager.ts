import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Manages profile fetching, onboarding state, and profile-related mutations.
 * Extracted from AuthProvider to isolate profile concerns.
 */
export function useProfileManager() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState(false);
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

  const fetchProfile = useCallback(async (userId: string, force = false) => {
    if (!userId) return;

    // Deduplicate: skip if already fetching for this user (unless forced)
    if (!force && fetchingRef.current === userId) return;
    fetchingRef.current = userId;

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, scheduled_deletion_at, onboarded_at, onboarding_step_reached, welcomed_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Stale-response guard
    if (fetchingRef.current !== userId) return;

    if (error) {
      console.warn("[auth] profile fetch error, keeping current state", error);
      resolvedUserIdRef.current = userId;
      setProfileResolved(true);
      return;
    }

    if (!data) {
      console.warn("[auth] no profile found, creating one");
      await supabase.from("profiles").insert({ user_id: userId });
      setDisplayName(null);
      setScheduledDeletionAt(null);
      setWelcomed(false);
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
    setWelcomed(!!(data as any)?.welcomed_at);

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
      setNeedsOnboarding(false);
    }

    resolvedUserIdRef.current = userId;
    setProfileResolved(true);
  }, []);

  /** Reset all profile state (e.g. on logout) */
  const resetProfile = useCallback(() => {
    setDisplayName(null);
    setScheduledDeletionAt(null);
    fetchingRef.current = null;
    resolvedUserIdRef.current = null;
    setProfileResolved(true);
    setNeedsOnboarding(false);
    setWelcomed(false);
    onboardingCompleteRef.current = localStorage.getItem("wildatlas_onboarded") === "true";
  }, []);

  /** Begin profile resolution for a new/different user */
  const beginProfileResolution = useCallback((userId: string) => {
    // Same user already resolved — skip to avoid routing flashes
    if (resolvedUserIdRef.current === userId) return;

    fetchingRef.current = null;
    // Always gate on profile fetch for a new/different user —
    // never let the dashboard render before we know onboarding state.
    setProfileResolved(false);
    resolvedUserIdRef.current = null;
    setTimeout(() => fetchProfile(userId), 0);
  }, [fetchProfile]);

  const clearDeletionSchedule = useCallback(() => setScheduledDeletionAt(null), []);

  const markOnboardingComplete = useCallback(() => {
    localStorage.setItem("wildatlas_onboarded", "true");
    onboardingCompleteRef.current = true;
    setNeedsOnboarding(false);
  }, []);

  const markWelcomed = useCallback((userId: string | undefined) => {
    setWelcomed(true);
    if (userId) {
      supabase
        .from("profiles")
        .update({ welcomed_at: new Date().toISOString() } as any)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) console.warn("[auth] Failed to persist welcomed_at:", error);
        });
    }
  }, []);

  const clearOnboardingFlag = useCallback(() => {
    localStorage.removeItem("wildatlas_onboarded");
    onboardingCompleteRef.current = false;
  }, []);

  return {
    displayName,
    scheduledDeletionAt,
    welcomed,
    profileResolved,
    needsOnboarding,
    onboardingStep,
    fetchProfile,
    resetProfile,
    beginProfileResolution,
    clearDeletionSchedule,
    markOnboardingComplete,
    markWelcomed,
    clearOnboardingFlag,
  };
}
