import { useEffect, useRef, type RefObject } from "react";

/**
 * Scroll-linked header fade.  Directly mutates a CSS custom property
 * via ref so React never re-renders.  Attaches to the nearest scrollable
 * ancestor of `scrollContainerRef`, or `window` when the page itself scrolls.
 */
export function useScrollFadeHeader(
  scrollContainerRef?: RefObject<HTMLElement | null>,
): RefObject<HTMLDivElement | null> {
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId: number;
    const target = scrollContainerRef?.current ?? null;

    const getScrollY = () =>
      target ? target.scrollTop : window.scrollY;

    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (headerRef.current) {
          const opacity = Math.max(0, 1 - getScrollY() / 100);
          headerRef.current.style.setProperty("--header-opacity", String(opacity));
        }
      });
    };

    const el = target ?? window;
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef]);

  return headerRef;
}
