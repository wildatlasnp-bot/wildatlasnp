import posthog from "@/lib/posthog";

/**
 * Measure tab-switch duration and report to PostHog.
 * Usage: const end = startTabSwitch("sniper","mochi"); ... end();
 */
export function startTabSwitch(from: string, to: string) {
  const t0 = performance.now();
  return () => {
    const ms = Math.round(performance.now() - t0);
    if (ms > 80) {
      posthog.capture("tab_switch_slow", { from, to, duration_ms: ms });
    }
  };
}

/**
 * Observe long tasks (>50ms) via PerformanceObserver and log to PostHog.
 * Call once at app startup. Batches events to avoid spamming.
 */
export function observeLongTasks() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    let batch: { duration: number; startTime: number }[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (batch.length === 0) return;
      const events = batch.splice(0, 10); // cap at 10 per flush
      posthog.capture("long_tasks_batch", {
        count: events.length,
        max_ms: Math.round(Math.max(...events.map((e) => e.duration))),
        tasks: events.map((e) => ({
          duration_ms: Math.round(e.duration),
          start: Math.round(e.startTime),
        })),
      });
      batch = [];
    };

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          batch.push({ duration: entry.duration, startTime: entry.startTime });
        }
      }
      if (batch.length > 0 && !flushTimer) {
        flushTimer = setTimeout(() => {
          flush();
          flushTimer = null;
        }, 5000);
      }
    });

    observer.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask not supported in this browser
  }
}
