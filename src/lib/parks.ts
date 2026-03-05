import { Mountain, MapPin, Tent, Trees, Footprints, Sun, Snowflake, Leaf, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ParkConfig {
  id: string;
  name: string;
  shortName: string;
  region: string;
  npsCode: string | null;
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
  rainier: {
    id: "rainier",
    name: "Mount Rainier National Park",
    shortName: "Rainier",
    region: "Washington",
    npsCode: "mora",
    tagline: "Permit alerts for Rainier. Never miss a spot.",
    heroDescription: "Summit attempts & backcountry loops.",
  },
  enchantments: {
    id: "enchantments",
    name: "Enchantments (Alpine Lakes Wilderness)",
    shortName: "Enchantments",
    region: "Washington",
    npsCode: null,
    tagline: "Permit alerts for the Enchantments. Snag a coveted overnight slot.",
    heroDescription: "Alpine lakes, larches & granite spires.",
  },
  whitney: {
    id: "whitney",
    name: "Mt. Whitney (Inyo National Forest)",
    shortName: "Mt. Whitney",
    region: "California",
    npsCode: null,
    tagline: "Permit alerts for Mt. Whitney. Reach the highest peak in the Lower 48.",
    heroDescription: "Day hikes & overnight summits at 14,505 ft.",
  },
  zion: {
    id: "zion",
    name: "Zion National Park",
    shortName: "Zion",
    region: "Utah",
    npsCode: "zion",
    tagline: "Permit alerts for Zion. Narrows & Angels Landing.",
    heroDescription: "Slot canyons, river hikes & iconic chains.",
  },
};

/** Icon map for known permit names — fallback to MapPin */
export const PERMIT_ICONS: Record<string, LucideIcon> = {
  "Half Dome": Mountain,
  "Yosemite Wilderness": Trees,
  "Wonderland Trail": Footprints,
  "Camp Muir": Mountain,
  "Wilderness Camping": Tent,
  "Enchantments Overnight": Mountain,
  "Mt. Whitney Day Hike": Sun,
  "Mt. Whitney Overnight": Mountain,
  "Zion Narrows": Waves,
  "Angels Landing (Summer)": Sun,
  "Angels Landing (Fall)": Leaf,
  "Angels Landing (Winter)": Snowflake,
};

export function getPermitIcon(permitName: string): LucideIcon {
  return PERMIT_ICONS[permitName] ?? MapPin;
}

/** All park IDs in display order */
export const ALL_PARK_IDS = Object.keys(PARKS);

/** The default park. Will become user-selectable. */
export const DEFAULT_PARK_ID = "yosemite";

export function getParkConfig(parkId: string): ParkConfig {
  return PARKS[parkId] ?? PARKS[DEFAULT_PARK_ID];
}
