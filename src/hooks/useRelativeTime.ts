import { useMemo, useSyncExternalStore } from "react";

/* ── Singleton tick manager ── */
let tick = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) {
    intervalId = setInterval(() => {
      tick += 1;
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return tick;
}

/* ── Formatting ── */
function format(ts: string | null, _tick: number): string {
  if (!ts) return "Pending scan…";
  const t = new Date(ts).getTime();
  if (isNaN(t)) return "Pending scan…";
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 7200) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} hr ago`;
}

/* ── Hook ── */
export function useRelativeTime(timestamp: string | null): string {
  const currentTick = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => format(timestamp, currentTick), [timestamp, currentTick]);
}
