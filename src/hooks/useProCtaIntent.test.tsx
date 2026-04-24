/**
 * Stability tests for useProCtaIntent.
 * ----------------------------------------------------------------------------
 * These tests stand in for a true browser e2e because the two scenarios we
 * care about — a hard refresh and a Stripe Checkout round-trip — both reduce
 * to "the hook re-mounts and must read the same intent it last persisted."
 *
 * We mock the auth + pro-status providers so we can deterministically simulate:
 *   1. A free user upgrades → intent persists as "upgrade".
 *   2. Hard refresh while auth is still loading → label/destination stay put.
 *   3. Stripe redirect returns the user as Pro → intent reconciles to "manage".
 *   4. A signed-out hard refresh → falls back to "signup" with no stale data.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the two upstream contexts. We control their return values per-test
// via the mutable `authState` / `proState` objects below.
const authState: { user: { id: string } | null; loading: boolean } = {
  user: null,
  loading: false,
};
const proState: { isPro: boolean; loading: boolean } = {
  isPro: false,
  loading: false,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("@/contexts/ProStatusContext", () => ({
  useProStatus: () => proState,
}));

// Import after mocks are registered.
import { useProCtaIntent } from "./useProCtaIntent";

const STORAGE_KEY = "wa.landing.proCtaIntent";

beforeEach(() => {
  window.sessionStorage.clear();
  authState.user = null;
  authState.loading = false;
  proState.isPro = false;
  proState.loading = false;
});

describe("useProCtaIntent — persistence & stability", () => {
  it("starts as 'signup' for an anonymous visitor and routes to /auth", () => {
    const { result } = renderHook(() => useProCtaIntent());
    expect(result.current.intent).toBe("signup");
    expect(result.current.destination).toEqual({
      kind: "navigate",
      path: "/auth?signup=true",
    });
    expect(result.current.copy.label).toBe("Upgrade to Pro");
  });

  it("reconciles to 'upgrade' once an authenticated free user resolves", () => {
    authState.user = { id: "u1" };
    proState.isPro = false;

    const { result } = renderHook(() => useProCtaIntent());

    expect(result.current.intent).toBe("upgrade");
    expect(result.current.destination).toEqual({ kind: "checkout" });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe("upgrade");
  });

  it("keeps the persisted label stable across a hard refresh while auth is restoring", () => {
    // First mount: free user resolves and persists "upgrade".
    authState.user = { id: "u1" };
    proState.isPro = false;
    const first = renderHook(() => useProCtaIntent());
    expect(first.result.current.intent).toBe("upgrade");
    first.unmount();

    // Simulate a hard refresh: auth providers are *still loading*. The hook
    // must hydrate from sessionStorage so the CTA doesn't flash "signup".
    authState.user = null;
    authState.loading = true;
    proState.loading = true;

    const second = renderHook(() => useProCtaIntent());
    expect(second.result.current.intent).toBe("upgrade");
    expect(second.result.current.destination).toEqual({ kind: "checkout" });
    expect(second.result.current.copy.labelMobile).toBe("Go Pro");
    expect(second.result.current.isResolving).toBe(true);
  });

  it("transitions 'upgrade' → 'manage' after a Stripe redirect upgrades the user", () => {
    // Pre-Stripe: free user, intent persisted as "upgrade".
    authState.user = { id: "u1" };
    proState.isPro = false;
    const before = renderHook(() => useProCtaIntent());
    expect(before.result.current.intent).toBe("upgrade");
    before.unmount();

    // Stripe redirect lands back on the app; auth is briefly loading again.
    authState.loading = true;
    proState.loading = true;
    const during = renderHook(() => useProCtaIntent());
    // Label must not flicker to "signup" — persisted hint wins while loading.
    expect(during.result.current.intent).toBe("upgrade");
    expect(during.result.current.copy.label).toBe("Upgrade to Pro");

    // Once the webhook propagates and contexts settle as Pro, reconcile.
    act(() => {
      authState.loading = false;
      proState.loading = false;
      proState.isPro = true;
      during.rerender();
    });

    expect(during.result.current.intent).toBe("manage");
    expect(during.result.current.destination).toEqual({ kind: "portal" });
    expect(during.result.current.copy.label).toBe("Manage subscription");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe("manage");
  });

  it("falls back to 'signup' on a hard refresh with no persisted hint", () => {
    // Anonymous, cold sessionStorage — nothing to hydrate from.
    authState.loading = true;
    const { result } = renderHook(() => useProCtaIntent());
    expect(result.current.intent).toBe("signup");
    expect(result.current.destination).toEqual({
      kind: "navigate",
      path: "/auth?signup=true",
    });
  });

  it("ignores corrupted sessionStorage values and re-derives the intent", () => {
    window.sessionStorage.setItem(STORAGE_KEY, "🐻garbage");
    authState.user = { id: "u1" };
    proState.isPro = true;

    const { result } = renderHook(() => useProCtaIntent());

    expect(result.current.intent).toBe("manage");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe("manage");
  });
});
