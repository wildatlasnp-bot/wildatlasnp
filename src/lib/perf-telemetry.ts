import posthog from "@/lib/posthog";

// --------------- In-memory event buffer ---------------

export interface PerfEvent {
  type: "tab_switch_slow" | "long_tasks_batch" | "park_switch_timing";
  timestamp: number;
  data: Record<string, unknown>;
}

const MAX_EVENTS = 200;
const perfEvents: PerfEvent[] = [];
const listeners = new Set<() => void>();

function pushEvent(event: PerfEvent) {
  perfEvents.push(event);
  if (perfEvents.length > MAX_EVENTS) perfEvents.shift();
  listeners.forEach((fn) => fn());
}

/** Subscribe to new perf events (for React components). Returns unsubscribe fn. */
export function subscribePerfEvents(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Get a snapshot of all captured perf events. */
export function getPerfEvents(): readonly PerfEvent[] {
  return perfEvents;
}

/** Clear all captured events. */
export function clearPerfEvents() {
  perfEvents.length = 0;
  listeners.forEach((fn) => fn());
}

// --------------- Tab-switch measurement ---------------

/**
 * Measure tab-switch duration and report to PostHog + local buffer.
 * Usage: const end = startTabSwitch("sniper","mochi"); ... end();
 */
export function startTabSwitch(from: string, to: string) {
  const t0 = performance.now();
  return () => {
    const ms = Math.round(performance.now() - t0);
    if (ms > 80) {
      const data = { from, to, duration_ms: ms };
      posthog.capture("tab_switch_slow", data);
      pushEvent({ type: "tab_switch_slow", timestamp: Date.now(), data });
    }
  };
}

// --------------- Park-switch telemetry ---------------

export interface ParkSwitchTiming {
  from: string;
  to: string;
  render_ms: number;
  network_ms: number | null;
}

/**
 * Measure a park switch. Returns { markNetwork, end }.
 * Call markNetwork() when the forecast request resolves.
 * Call end() after the first post-switch paint (via rAF).
 */
export function startParkSwitch(from: string, to: string) {
  const t0 = performance.now();
  let networkMs: number | null = null;

  return {
    markNetwork() {
      networkMs = Math.round(performance.now() - t0);
    },
    end() {
      const renderMs = Math.round(performance.now() - t0);
      const timing: ParkSwitchTiming = {
        from,
        to,
        render_ms: renderMs,
        network_ms: networkMs,
      };
      posthog.capture("park_switch_timing", timing);
      pushEvent({
        type: "park_switch_timing",
        timestamp: Date.now(),
        data: timing as unknown as Record<string, unknown>,
      });
    },
  };
}

// --------------- Long-task observer ---------------

/**
 * Observe long tasks (>50ms) via PerformanceObserver and log to PostHog + local buffer.
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
      const data = {
        count: events.length,
        max_ms: Math.round(Math.max(...events.map((e) => e.duration))),
        tasks: events.map((e) => ({
          duration_ms: Math.round(e.duration),
          start: Math.round(e.startTime),
        })),
      };
      posthog.capture("long_tasks_batch", data);
      pushEvent({ type: "long_tasks_batch", timestamp: Date.now(), data });
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
