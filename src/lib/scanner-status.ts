/**
 * Single source of truth for scanner status logic.
 * All scanner-related UI must derive state from these shared types and functions.
 */

/** Freshness threshold — scanner is "delayed" if last successful scan is older than this */
export const SCAN_FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/** Canonical scanner states */
export type ScannerState = "active" | "delayed" | "starting" | "paused" | "error";

/** Derive the canonical scanner state from heartbeat data */
export function deriveScannerState(
  lastSuccessfulScanAt: string | null,
  heartbeatError: boolean = false,
): ScannerState {
  if (heartbeatError) return "error";
  if (!lastSuccessfulScanAt) return "starting";

  const ageMs = Date.now() - new Date(lastSuccessfulScanAt).getTime();
  return ageMs > SCAN_FRESHNESS_THRESHOLD_MS ? "delayed" : "active";
}

/** Human-readable labels for each scanner state */
export const SCANNER_STATE_LABELS: Record<ScannerState, string> = {
  active: "Scanner Active",
  delayed: "Scanner Delayed",
  starting: "Scanner Starting",
  paused: "Scanner Paused",
  error: "Scanner Error",
};

/** Format a relative time string from an ISO date */
export function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}
