/**
 * park-accent — per-park atmospheric accent palette.
 *
 * Distinct from PARK_COLORS in `src/lib/parks.ts`, which are bolder
 * *identity* colors used for badges, hero gradients, and alert dots.
 * The accent is a quieter "whisper of place" — applied as CSS custom
 * properties on :root and consumed by a small set of surfaces:
 *
 *   - Poko coordinate stamp + thin rule below POKO wordmark
 *   - Discover hero crowd pill border + FIELD REPORT eyebrow
 *   - Field Dispatch header rule
 *   - Settings membership card border tint (when 1 primary park)
 *
 * Functional elements (CTAs, toggles, scanner dots, READY status, active
 * nav dot) are immune — they stay brand green #2F6F4E regardless.
 *
 * Defaults to brand amber (#C9A96E) when no park is active or on
 * multi-park screens. The system always has a value.
 */

export interface ParkAccent {
  hex: string;
  rgb: string; // "r, g, b" — for use in rgba(var(--park-accent-rgb), α)
}

export const DEFAULT_PARK_ACCENT: ParkAccent = {
  hex: "#C9A96E",
  rgb: "201, 169, 110",
};

export const PARK_ACCENTS: Record<string, ParkAccent> = {
  yosemite:       { hex: "#C4A882", rgb: "196, 168, 130" }, // warm granite gold
  rainier:        { hex: "#6B9EB2", rgb: "107, 158, 178" }, // glacier blue
  zion:           { hex: "#C17A5A", rgb: "193, 122,  90" }, // canyon red
  glacier:        { hex: "#5A9E9A", rgb: " 90, 158, 154" }, // ice teal
  grand_canyon:   { hex: "#C9824A", rgb: "201, 130,  74" }, // mesa amber
  rocky_mountain: { hex: "#7A9E7A", rgb: "122, 158, 122" }, // alpine sage
  arches:         { hex: "#C4855A", rgb: "196, 133,  90" }, // sandstone
  grand_teton:    { hex: "#5A7EA0", rgb: " 90, 126, 160" }, // lake blue
};

export function getParkAccent(parkId: string | null | undefined): ParkAccent {
  if (!parkId) return DEFAULT_PARK_ACCENT;
  return PARK_ACCENTS[parkId] ?? DEFAULT_PARK_ACCENT;
}

/** Push the active park accent onto the document root.
 *  Pass `null` to revert to the brand-amber default (multi-park screens). */
export function applyParkAccent(parkId: string | null | undefined): void {
  if (typeof document === "undefined") return;
  const accent = getParkAccent(parkId);
  const root = document.documentElement;
  root.style.setProperty("--park-accent", accent.hex);
  root.style.setProperty("--park-accent-rgb", accent.rgb);
}
