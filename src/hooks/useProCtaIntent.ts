import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/contexts/ProStatusContext";

/**
 * useProCtaIntent
 * ----------------------------------------------------------------------------
 * Tiny state machine that owns the Pro CTA's *intent* — the single piece of
 * truth that drives both the visible label and the click destination.
 *
 * States:
 *   - "signup"  → visitor isn't authenticated. CTA routes to /auth?signup=true.
 *   - "upgrade" → authenticated free user. CTA opens Stripe Checkout.
 *   - "manage"  → authenticated Pro user. CTA opens the Stripe billing portal.
 *
 * The resolved intent is persisted to sessionStorage so the label and
 * destination stay stable through the auth restore flicker and Stripe's
 * external redirect round-trip. The persisted value is only trusted as a
 * *hint* during initial paint; once the live auth + pro-status signals
 * resolve, the machine re-derives the canonical intent and re-persists it.
 *
 * Designed to be the single source of truth — callers should never branch on
 * `user`/`isPro` directly for CTA copy or routing. They should call
 * `useProCtaIntent()` and read `{ intent, label, destination }`.
 */

export type ProCtaIntent = "signup" | "upgrade" | "manage";

export type ProCtaDestination =
  | { kind: "navigate"; path: string }
  | { kind: "checkout" }
  | { kind: "portal" };

interface ProCtaCopy {
  /** Long-form label used on desktop. */
  label: string;
  /** Compact label used on mobile. */
  labelMobile: string;
  /** Loading verb used while the destination handler is in flight. */
  loadingLabel: string;
}

const STORAGE_KEY = "wa.landing.proCtaIntent";
const VALID: ReadonlySet<ProCtaIntent> = new Set(["signup", "upgrade", "manage"]);

const COPY: Record<ProCtaIntent, ProCtaCopy> = {
  signup:  { label: "Upgrade to Pro",      labelMobile: "Go Pro",     loadingLabel: "Opening…" },
  upgrade: { label: "Upgrade to Pro",      labelMobile: "Go Pro",     loadingLabel: "Opening checkout…" },
  manage:  { label: "Manage subscription", labelMobile: "Manage Pro", loadingLabel: "Opening portal…" },
};

const DESTINATION: Record<ProCtaIntent, ProCtaDestination> = {
  signup:  { kind: "navigate", path: "/auth?signup=true" },
  upgrade: { kind: "checkout" },
  manage:  { kind: "portal" },
};

/** Hydrate a persisted hint synchronously so the first render is stable. */
function readPersistedIntent(): ProCtaIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw as ProCtaIntent)) return raw as ProCtaIntent;
  } catch {
    // Ignore storage exceptions (private mode, disabled storage, etc.)
  }
  return null;
}

function persistIntent(intent: ProCtaIntent): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, intent);
  } catch {
    // Best-effort persistence; the in-memory state is still correct.
  }
}

/** Derive the canonical intent from live auth + Pro signals. */
function deriveIntent(args: { hasUser: boolean; isPro: boolean }): ProCtaIntent {
  if (!args.hasUser) return "signup";
  return args.isPro ? "manage" : "upgrade";
}

export interface ProCtaIntentResult {
  /** Current intent. Hydrated synchronously, then reconciled. */
  intent: ProCtaIntent;
  /** Long + short labels and the loading verb. */
  copy: ProCtaCopy;
  /** Destination descriptor — caller decides how to execute it. */
  destination: ProCtaDestination;
  /** True until both auth and pro-status have resolved at least once. */
  isResolving: boolean;
}

export function useProCtaIntent(): ProCtaIntentResult {
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: proLoading } = useProStatus();

  // Hydrate from sessionStorage synchronously to avoid a label flip on mount.
  const [intent, setIntent] = useState<ProCtaIntent>(
    () => readPersistedIntent() ?? "signup"
  );

  const isResolving = authLoading || proLoading;

  useEffect(() => {
    // Only reconcile once the upstream signals have settled. While loading,
    // we keep the persisted hint to prevent the CTA from flickering.
    if (isResolving) return;
    const next = deriveIntent({ hasUser: !!user, isPro });
    setIntent((prev) => {
      if (prev === next) return prev;
      persistIntent(next);
      return next;
    });
  }, [isResolving, user, isPro]);

  return useMemo(
    () => ({
      intent,
      copy: COPY[intent],
      destination: DESTINATION[intent],
      isResolving,
    }),
    [intent, isResolving]
  );
}
