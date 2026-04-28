import { useEffect, useState } from "react";

/**
 * useSettlingSkeleton — returns `true` for `ms` ms whenever `key` changes.
 *
 * Lets us show a premium shimmer beat across content that swaps synchronously
 * (e.g. switching parks). Bridges the visual gap so the experience feels
 * deliberately premium rather than snapping. Honors prefers-reduced-motion
 * by returning false immediately.
 */
export function useSettlingSkeleton(key: unknown, ms = 320): boolean {
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      setSettling(false);
      return;
    }
    setSettling(true);
    const t = window.setTimeout(() => setSettling(false), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);

  return settling;
}
