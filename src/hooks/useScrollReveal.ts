import { useEffect, useRef, useState } from "react";

/**
 * Scroll-driven reveal — adds `is-visible` to the returned ref's element
 * the first time it intersects within the nearest scroll container.
 *
 * Usage:
 *   const ref = useScrollReveal<HTMLDivElement>();
 *   <section ref={ref} className="wa-scroll-reveal" style={{ ['--d' as any]: '120ms' }} />
 *
 * Options:
 *   - threshold: visibility ratio that triggers reveal (default 0.12)
 *   - rootMargin: extends/shrinks the viewport (default '0px 0px -8% 0px')
 *   - once: stop observing after first reveal (default true)
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(opts?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  const threshold = opts?.threshold ?? 0.08;
  const rootMargin = opts?.rootMargin ?? "0px 0px -40px 0px";
  const once = opts?.once ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Honor reduced motion — reveal immediately, no observer.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    // Find the nearest scrollable ancestor (Discover uses [data-tab-scroll]).
    let root: Element | null = el.parentElement;
    while (root && root !== document.body) {
      if (root.hasAttribute("data-tab-scroll")) break;
      const s = getComputedStyle(root);
      if (/(auto|scroll)/.test(s.overflowY)) break;
      root = root.parentElement;
    }
    if (root === document.body) root = null;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { root, threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, visible } as const;
}
