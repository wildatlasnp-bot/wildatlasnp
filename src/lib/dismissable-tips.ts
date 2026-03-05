/**
 * Central registry of localStorage keys used for dismissable tips, banners,
 * and tooltips. Add new keys here so the "Reset Tips" button in Settings
 * clears them all automatically.
 */
export const DISMISSABLE_KEYS = [
  "wildatlas_sniper_intro_dismissed",
  // Add future dismissable tip/banner keys below:
  // "wildatlas_discover_intro_dismissed",
  // "wildatlas_crowd_tooltip_dismissed",
] as const;

export function resetAllTips() {
  DISMISSABLE_KEYS.forEach((key) => localStorage.removeItem(key));
}
