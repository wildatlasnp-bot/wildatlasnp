import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared status-row opacity controller for the Poko composer.
 *
 * Both composers (briefing + conversation) share the same scroll-fade
 * behavior. Centralizing it in a hook means each composer only needs to:
 *   1) Call this hook once per mount in the parent component.
 *   2) Attach the returned `setScrollRef` to its scrollable container's `ref`.
 *   3) Wire `handleChatScroll` to that container's `onScroll`.
 *   4) Apply `statusOpacity` / `statusSnap` to the status-row style.
 *
 * The hook handles: callback-ref tracking of the live element, debounced
 * resample on layout changes, ResizeObserver wiring, mode-swap snap reset,
 * stream-finish snap reset, and a dev-mode flicker invariant.
 */
export type ComposerMode = "briefing" | "conversation";

interface UseStatusRowOpacityArgs {
  /** True while a reply is streaming. Falling edge triggers a snap-to-1. */
  isLoading: boolean;
  /** Current composer mode. Any change triggers a snap-to-1 and resample. */
  composerMode: ComposerMode;
  /**
   * A monotonically-changing value (e.g. `messages.length` or the messages
   * array reference) that signals "layout-shifting content changed." Re-runs
   * the debounced resample so the row settles on its post-layout position.
   */
  layoutSignal: unknown;
  /** Distance (px) from bottom at which opacity reaches 0. */
  fadeDistance?: number;
  /** Settle delay (ms) for the trailing resample after a transition. */
  trailingSettleMs?: number;
  /** Settle delay (ms) for ResizeObserver-driven resamples. */
  resizeSettleMs?: number;
  /** Component name used in dev-mode flicker warnings. */
  debugLabel?: string;
}

export function useStatusRowOpacity({
  isLoading,
  composerMode,
  layoutSignal,
  fadeDistance = 160,
  trailingSettleMs = 360,
  resizeSettleMs = 120,
  debugLabel = "StatusRow",
}: UseStatusRowOpacityArgs) {
  const [statusOpacity, setStatusOpacity] = useState(1);
  const [statusSnap, setStatusSnap] = useState(false);

  // Dev-mode invariant: during a snap window the row must read exactly 1.
  const snapWindowActiveRef = useRef(false);
  const snapToFull = useCallback(() => {
    snapWindowActiveRef.current = true;
    setStatusSnap(true);
    setStatusOpacity(1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStatusSnap(false);
        snapWindowActiveRef.current = false;
      });
    });
  }, []);
  if (process.env.NODE_ENV !== "production" && snapWindowActiveRef.current) {
    if (statusOpacity > 0 && statusOpacity < 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `[${debugLabel}] status row flicker invariant violated:`,
        `statusOpacity=${statusOpacity.toFixed(3)} during snap window`,
      );
    }
  }

  // Callback-ref tracked container so opacity always reads the live element.
  const [activeScrollEl, setActiveScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    setActiveScrollEl(el);
  }, []);

  const computeStatusOpacityFromEl = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = Math.max(0, Math.min(1, 1 - distanceFromBottom / fadeDistance));
    setStatusOpacity((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
  }, [fadeDistance]);

  const resampleRafRef = useRef<number>(0);
  const resampleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScheduledResample = useCallback(() => {
    if (resampleRafRef.current) {
      cancelAnimationFrame(resampleRafRef.current);
      resampleRafRef.current = 0;
    }
    if (resampleTimeoutRef.current) {
      clearTimeout(resampleTimeoutRef.current);
      resampleTimeoutRef.current = null;
    }
  }, []);
  const scheduleResample = useCallback((el: HTMLElement | null, settleMs = resizeSettleMs) => {
    if (!el) return;
    cancelScheduledResample();
    resampleRafRef.current = requestAnimationFrame(() => {
      resampleTimeoutRef.current = setTimeout(() => {
        computeStatusOpacityFromEl(el);
        resampleTimeoutRef.current = null;
      }, settleMs);
    });
  }, [computeStatusOpacityFromEl, cancelScheduledResample, resizeSettleMs]);
  useEffect(() => () => cancelScheduledResample(), [cancelScheduledResample]);

  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    computeStatusOpacityFromEl(e.currentTarget);
  }, [computeStatusOpacityFromEl]);

  // Stream-finish snap (falling edge of isLoading).
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      snapToFull();
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, snapToFull]);

  // Layout-signal driven resample (immediate + trailing debounced sample).
  useEffect(() => {
    if (!activeScrollEl) return;
    computeStatusOpacityFromEl(activeScrollEl);
    scheduleResample(activeScrollEl, trailingSettleMs);
  }, [layoutSignal, activeScrollEl, computeStatusOpacityFromEl, scheduleResample, trailingSettleMs]);

  // ResizeObserver — coalesces rapid resize bursts (e.g. suggestion chips
  // mounting, font-load reflow, virtual keyboard). Strategy:
  //   • Leading edge: cancel any pending resample so we never apply a stale
  //     mid-burst sample on top of a still-shifting layout.
  //   • Trailing edge: schedule one resample after `resizeSettleMs` of quiet,
  //     capped by `maxResizeWaitMs` so a continuous resize stream still
  //     settles eventually.
  // The leading-edge cancel is what prevents jitter — without it, every
  // observed frame queues its own rAF+timeout pair and they all fire in
  // sequence as the layout changes shape.
  useEffect(() => {
    if (!activeScrollEl || typeof ResizeObserver === "undefined") return;
    let burstStartedAt = 0;
    const maxResizeWaitMs = Math.max(resizeSettleMs * 4, 480);
    const ro = new ResizeObserver(() => {
      const now = performance.now();
      if (burstStartedAt === 0) burstStartedAt = now;
      const elapsed = now - burstStartedAt;
      // Cancel any in-flight resample so it can't fire mid-burst.
      cancelScheduledResample();
      const remaining = Math.max(0, maxResizeWaitMs - elapsed);
      const settle = Math.min(resizeSettleMs, remaining);
      scheduleResample(activeScrollEl, settle);
      // Reset burst tracking once we've reached the cap so the next quiet
      // period starts a fresh window.
      if (elapsed >= maxResizeWaitMs) burstStartedAt = 0;
    });
    ro.observe(activeScrollEl);
    return () => {
      ro.disconnect();
      burstStartedAt = 0;
    };
  }, [activeScrollEl, scheduleResample, cancelScheduledResample, resizeSettleMs]);

  // Composer mode toggle — cancel any pending resample, snap, reschedule.
  const prevComposerModeRef = useRef(composerMode);
  useEffect(() => {
    if (prevComposerModeRef.current !== composerMode) {
      cancelScheduledResample();
      snapToFull();
      scheduleResample(activeScrollEl, trailingSettleMs);
      prevComposerModeRef.current = composerMode;
    }
  }, [composerMode, activeScrollEl, snapToFull, scheduleResample, cancelScheduledResample, trailingSettleMs]);

  // Scroll-container re-attach — cancel pending, snap, reschedule.
  useEffect(() => {
    if (!activeScrollEl) return;
    cancelScheduledResample();
    snapToFull();
    scheduleResample(activeScrollEl, trailingSettleMs);
  }, [activeScrollEl, snapToFull, scheduleResample, cancelScheduledResample, trailingSettleMs]);

  return {
    /** Apply to the status-row style `opacity` and `transform` calculation. */
    statusOpacity,
    /** True during a snap window — switch transition to none in render style. */
    statusSnap,
    /** Attach as `ref` to the composer's scrollable container. */
    setScrollRef,
    /** Wire to `onScroll` on the same container. */
    handleChatScroll,
    /** Imperatively snap the row back to full opacity. */
    snapToFull,
    /** The currently mounted scroll container (or null). */
    activeScrollEl,
  };
}
