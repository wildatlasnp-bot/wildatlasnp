import { Mountain, MapPin, Tent, Trees } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ParkConfig {
  id: string;
  name: string;
  shortName: string;
  region: string;
  npsCode: string;
  tagline: string;
  heroDescription: string;
}

export interface PermitDisplay {
  permitId: string;
  name: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Client-side park registry.
 * The DB `parks` and `park_permits` tables are the source of truth.
 * This config provides UI-specific metadata (icons, copy) keyed by park_id.
 */
export const PARKS: Record<string, ParkConfig> = {
  yosemite: {
    id: "yosemite",
    name: "Yosemite National Park",
    shortName: "Yosemite",
    region: "California",
    npsCode: "yose",
    tagline: "Permit alerts for Yosemite. Never miss a spot.",
    heroDescription: "Tactical logistics for the modern ranger.",
  },
};

/** Icon map for known permit names — fallback to MapPin */
export const PERMIT_ICONS: Record<string, LucideIcon> = {
  "Half Dome": Mountain,
  "Yosemite Wilderness": Trees,
  // Future parks
  "Enchantments": Mountain,
  "Mt. Whitney": Mountain,
  "Zion Narrows": MapPin,
};

export function getPermitIcon(permitName: string): LucideIcon {
  return PERMIT_ICONS[permitName] ?? MapPin;
}

/** The currently active park. Will become user-selectable. */
export const DEFAULT_PARK_ID = "yosemite";

export function getParkConfig(parkId: string): ParkConfig {
  return PARKS[parkId] ?? PARKS[DEFAULT_PARK_ID];
}
