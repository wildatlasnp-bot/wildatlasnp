import { Mountain, MapPin, Tent, Trees, Footprints, Sun, Snowflake, Leaf, Waves, Flame } from "lucide-react";
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
    heroDescription: "Half Dome, Valley views & iconic wilderness.",
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
  zion: {
    id: "zion",
    name: "Zion National Park",
    shortName: "Zion",
    region: "Utah",
    npsCode: "zion",
    tagline: "Permit alerts for Zion. Narrows & Angels Landing.",
    heroDescription: "Slot canyons, river hikes & iconic chains.",
  },
  glacier: {
    id: "glacier",
    name: "Glacier National Park",
    shortName: "Glacier",
    region: "Montana",
    npsCode: "glac",
    tagline: "Permit alerts for Glacier. Pristine alpine wilderness.",
    heroDescription: "Glacial lakes, rugged peaks & wild backcountry.",
  },
  rocky_mountain: {
    id: "rocky_mountain",
    name: "Rocky Mountain National Park",
    shortName: "Rocky Mountain",
    region: "Colorado",
    npsCode: "romo",
    tagline: "Permit alerts for Rocky Mountain. Alpine tundra awaits.",
    heroDescription: "Longs Peak, elk meadows & alpine loops.",
  },
  arches: {
    id: "arches",
    name: "Arches National Park",
    shortName: "Arches",
    region: "Utah",
    npsCode: "arch",
    tagline: "Permit alerts for Arches. Explore the Fiery Furnace.",
    heroDescription: "Sandstone arches, fins & desert towers.",
  },
  grand_canyon: {
    id: "grand_canyon",
    name: "Grand Canyon National Park",
    shortName: "Grand Canyon",
    region: "Arizona",
    npsCode: "grca",
    tagline: "Permit alerts for Grand Canyon. Rim to river.",
    heroDescription: "Mile-deep canyon, desert trails & Colorado River.",
  },
};

/** Icon map for known permit names — fallback to MapPin */
export const PERMIT_ICONS: Record<string, LucideIcon> = {
  "Half Dome": Mountain,
  "Yosemite Wilderness": Trees,
  "Wonderland Trail": Footprints,
  "Camp Muir": Mountain,
  "Wilderness Camping": Tent,
  "Zion Narrows": Waves,
  "Angels Landing (Summer)": Sun,
  "Angels Landing (Fall)": Leaf,
  "Angels Landing (Winter)": Snowflake,
  "Fiery Furnace": Flame,
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
