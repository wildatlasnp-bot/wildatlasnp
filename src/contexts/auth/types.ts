import type { User, Session } from "@supabase/supabase-js";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  scheduledDeletionAt: string | null;
  welcomed: boolean;
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
  markOnboardingComplete: () => void;
  markWelcomed: () => void;
}

export interface ProfileData {
  displayName: string | null;
  scheduledDeletionAt: string | null;
  welcomed: boolean;
  needsOnboarding: boolean;
  onboardingStep: number;
}
