/**
 * Saved Signals — user-captured snippets from the Poko chat that surface
 * on the Discover tab under "User intel". Persisted to localStorage per
 * user (or "guest"); broadcasts a `wa-saved-signals` event so any
 * subscriber can re-read.
 */

export interface SavedSignal {
  id: string;
  parkId: string;
  /** Original assistant content, stripped of markdown noise. */
  text: string;
  /** ms since epoch */
  capturedAt: number;
}

const KEY_PREFIX = "wa_saved_signals::";
const EVENT_NAME = "wa-saved-signals";
const MAX_PER_PARK = 40;
const MAX_TEXT_LEN = 600;

const storeKey = (userKey: string) => `${KEY_PREFIX}${userKey || "guest"}`;

export function readSignals(userKey: string): SavedSignal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storeKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSignals(userKey: string, items: SavedSignal[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storeKey(userKey), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* quota — non-fatal */
  }
}

export function saveSignal(
  userKey: string,
  input: { parkId: string; text: string },
): SavedSignal {
  const text = (input.text || "").trim().slice(0, MAX_TEXT_LEN);
  const newItem: SavedSignal = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    parkId: input.parkId,
    text,
    capturedAt: Date.now(),
  };
  const all = readSignals(userKey);
  // Deduplicate identical text in same park within 60s
  const isDupe = all.some(
    (s) =>
      s.parkId === newItem.parkId &&
      s.text === newItem.text &&
      Date.now() - s.capturedAt < 60_000,
  );
  if (isDupe) return newItem;

  const next = [newItem, ...all];
  // Cap per park
  const grouped = new Map<string, SavedSignal[]>();
  for (const s of next) {
    const arr = grouped.get(s.parkId) ?? [];
    if (arr.length < MAX_PER_PARK) arr.push(s);
    grouped.set(s.parkId, arr);
  }
  writeSignals(userKey, [...grouped.values()].flat());
  return newItem;
}

export function removeSignal(userKey: string, id: string) {
  const all = readSignals(userKey);
  writeSignals(
    userKey,
    all.filter((s) => s.id !== id),
  );
}

export function isSignalSaved(
  userKey: string,
  parkId: string,
  text: string,
): boolean {
  const trimmed = (text || "").trim().slice(0, MAX_TEXT_LEN);
  return readSignals(userKey).some(
    (s) => s.parkId === parkId && s.text === trimmed,
  );
}

export function subscribeSavedSignals(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

/* ── Capture animation ──
 * Clones the source element, animates it to the Discover nav icon, then
 * removes it. No-ops gracefully if the destination isn't on screen
 * (e.g. desktop side-rail off-canvas).
 */
export function flyToDock(sourceEl: HTMLElement) {
  if (typeof window === "undefined") return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  // Pick whichever dock target is currently visible
  const target =
    (document.querySelector('[data-nav-target="discover"]:not([hidden])') as HTMLElement | null) ??
    (document.querySelectorAll('[data-nav-target="discover"]')[0] as HTMLElement | null);
  if (!target) return;

  const srcRect = sourceEl.getBoundingClientRect();
  const tgtRect = target.getBoundingClientRect();
  if (srcRect.width === 0 || tgtRect.width === 0) return;

  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  // Strip interactive children so the ghost is purely visual
  ghost.querySelectorAll("button, a, input, textarea").forEach((el) => {
    (el as HTMLElement).style.pointerEvents = "none";
  });

  Object.assign(ghost.style, {
    position: "fixed",
    top: `${srcRect.top}px`,
    left: `${srcRect.left}px`,
    width: `${srcRect.width}px`,
    height: `${srcRect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "9999",
    transformOrigin: "top left",
    transition:
      "transform 620ms cubic-bezier(0.4, 0, 0.2, 1), opacity 620ms cubic-bezier(0.4, 0, 0.2, 1), filter 620ms cubic-bezier(0.4, 0, 0.2, 1)",
    willChange: "transform, opacity, filter",
    boxShadow: "0 12px 32px rgba(15, 42, 27, 0.32)",
  } as CSSStyleDeclaration);

  document.body.appendChild(ghost);

  // Force layout, then animate
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  ghost.getBoundingClientRect();

  const dx = tgtRect.left + tgtRect.width / 2 - (srcRect.left + srcRect.width / 2);
  const dy = tgtRect.top + tgtRect.height / 2 - (srcRect.top + srcRect.height / 2);
  // Final scale: shrink toward icon size
  const scale = Math.max(0.06, Math.min(tgtRect.width / srcRect.width, 0.18));

  requestAnimationFrame(() => {
    ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
    ghost.style.opacity = "0";
    ghost.style.filter = "blur(1px)";
  });

  // Brief pulse on the dock target when the ghost arrives
  window.setTimeout(() => {
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.18)" },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }, 480);

  window.setTimeout(() => {
    ghost.remove();
  }, 700);
}
