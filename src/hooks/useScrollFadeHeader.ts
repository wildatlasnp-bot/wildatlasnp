import { useEffect, useRef, type RefObject } from "react";

/**
 * Scroll-linked header fade. Directly mutates a CSS custom property
 * via ref — zero React re-renders. Walks up from the header element
 * to find the nearest scrollable ancestor automatically.
 */
export function useScrollFadeHeader(): RefObject<HTMLDivElement | null> {
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    // Walk up to find the nearest scrollable ancestor
    let scrollEl: HTMLElement | null = header.parentElement;
    while (scrollEl && scrollEl !== document.body) {
      const { overflowY } = getComputedStyle(scrollEl);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollEl = scrollEl.parentElement;
    }

    const target: HTMLElement | Window = scrollEl && scrollEl !== document.body ? scrollEl : window;

    let rafId: number;
    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (!headerRef.current) return;
        const scrollY = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
        const opacity = Math.max(0, 1 - scrollY / 100);
        headerRef.current.style.setProperty("--header-opacity", String(opacity));
      });
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return headerRef;
}
