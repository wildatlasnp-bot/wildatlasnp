// WildAtlas haptic feedback utility
// TODO: Replace with Capacitor Haptics for native iOS
// navigator.vibrate() is Android/PWA only — iOS Safari silently no-ops via the support check
const isHapticsSupported = () =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptics = {
  // Light — UI feedback
  light: () => isHapticsSupported() && navigator.vibrate(8),

  // Medium — confirmations
  medium: () => isHapticsSupported() && navigator.vibrate(15),

  // Strong — significant events
  strong: () => isHapticsSupported() && navigator.vibrate(25),

  // Catch — permit found, most important moment
  catch: () => isHapticsSupported() && navigator.vibrate([20, 60, 20]),

  // Error — something went wrong
  error: () => isHapticsSupported() && navigator.vibrate([10, 30, 10, 30, 10]),

  // Scan pulse — subtle active scanning indicator
  scan: () => isHapticsSupported() && navigator.vibrate(4),
};
