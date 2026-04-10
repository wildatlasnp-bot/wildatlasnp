import { Mountain, MapPin, Tent, Trees, Footprints, Sun, Snowflake, Leaf, Waves, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import yosemiteHero from "@/assets/parks/yosemite-hero.jpg";
import zionHero from "@/assets/parks/zion-hero.jpg";
import grandCanyonHero from "@/assets/parks/grand-canyon-hero.jpg";
import grandTetonHero from "@/assets/parks/grand-teton-hero.jpg";
import glacierHero from "@/assets/parks/glacier-hero.jpg";
import rockyMountainHero from "@/assets/parks/rocky-mountain-hero.jpg";
import rainierHero from "@/assets/parks/rainier-hero.jpg";
import archesHero from "@/assets/parks/arches-hero.jpg";

export interface ParkConfig {
  id: string;
  name: string;
  shortName: string;
  region: string;
  npsCode: string | null;
  tagline: string;
  heroDescription: string;
  heroImage?: string;
  pillBg: string;
  pillBorder: string;
  primaryColor: string;
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
// PARK_COLORS — single source of truth for park identity colors.
// Keyed by park_id (slug string matching database).
// Maintain alphabetical order by park name for auditability.
// If a new park is added, assign a color here before referencing it anywhere in the UI.
// Note: Arches (#A05A2C) is a dusty sienna, deliberately shifted warmer/more muted
// than Zion (#C94A2A) to ensure contrast at small dot sizes and for color vision deficiencies.
export const PARK_COLORS: Record<string, string> = {
  arches:         '#A05A2C',  // dusty sienna
  glacier:        '#1A7A6E',  // teal
  grand_canyon:   '#B8701A',  // deep amber/ochre
  grand_teton:    '#3A5F8A',  // slate blue
  rainier:        '#7A4E9E',  // muted violet
  rocky_mountain: '#5C3D8F',  // deep purple
  yosemite:       '#2F6F4E',  // forest green — Hero Green
  zion:           '#C94A2A',  // warm red-orange
};

/**
 * Get the canonical color for a park. All components must use this —
 * never access PARK_COLORS directly — so the warning and fallback are always guaranteed.
 */
export function getParkColor(parkId: string): string {
  const color = PARK_COLORS[parkId];
  if (!color) {
    console.warn(`[PARK_COLORS] No color found for park_id: "${parkId}". Add it to src/lib/parks.ts.`);
    return 'var(--color-text-tertiary, #9CA3AF)';
  }
  return color;
}

export const PARKS: Record<string, ParkConfig> = {
  yosemite: {
    id: "yosemite",
    name: "Yosemite National Park",
    shortName: "Yosemite",
    region: "California",
    npsCode: "yose",
    tagline: "Permit alerts for Yosemite. Never miss a spot.",
    heroDescription: "Half Dome, Valley views & iconic wilderness.",
    heroImage: yosemiteHero,
    pillBg: "#EAF3DE", pillBorder: "#C0DD97", primaryColor: PARK_COLORS.yosemite,
  },
  rainier: {
    id: "rainier",
    name: "Mount Rainier National Park",
    shortName: "Rainier",
    region: "Washington",
    npsCode: "mora",
    tagline: "Permit alerts for Rainier. Never miss a spot.",
    heroDescription: "Summit attempts & backcountry loops.",
    heroImage: rainierHero,
    pillBg: "#E8F0F3", pillBorder: "#A4C4D0", primaryColor: PARK_COLORS.rainier,
  },
  zion: {
    id: "zion",
    name: "Zion National Park",
    shortName: "Zion",
    region: "Utah",
    npsCode: "zion",
    tagline: "Permit alerts for Zion. Narrows & Angels Landing.",
    heroDescription: "Slot canyons, river hikes & iconic chains.",
    heroImage: zionHero,
    pillBg: "#F5EDE3", pillBorder: "#D4A87A", primaryColor: PARK_COLORS.zion,
  },
  glacier: {
    id: "glacier",
    name: "Glacier National Park",
    shortName: "Glacier",
    region: "Montana",
    npsCode: "glac",
    tagline: "Permit alerts for Glacier. Pristine alpine wilderness.",
    heroDescription: "Glacial lakes, rugged peaks & wild backcountry.",
    heroImage: glacierHero,
    pillBg: "#E6EEF3", pillBorder: "#8FBAD0", primaryColor: PARK_COLORS.glacier,
  },
  rocky_mountain: {
    id: "rocky_mountain",
    name: "Rocky Mountain National Park",
    shortName: "Rocky Mountain",
    region: "Colorado",
    npsCode: "romo",
    tagline: "Permit alerts for Rocky Mountain. Alpine tundra awaits.",
    heroDescription: "Longs Peak, elk meadows & alpine loops.",
    heroImage: rockyMountainHero,
    pillBg: "#EAF0E8", pillBorder: "#A8C49A", primaryColor: PARK_COLORS.rocky_mountain,
  },
  arches: {
    id: "arches",
    name: "Arches National Park",
    shortName: "Arches",
    region: "Utah",
    npsCode: "arch",
    tagline: "Permit alerts for Arches. Explore the Fiery Furnace.",
    heroDescription: "Sandstone arches, fins & desert towers.",
    heroImage: archesHero,
    pillBg: "#F5EAE0", pillBorder: "#D4926A", primaryColor: PARK_COLORS.arches,
  },
  grand_canyon: {
    id: "grand_canyon",
    name: "Grand Canyon National Park",
    shortName: "Grand Canyon",
    region: "Arizona",
    npsCode: "grca",
    tagline: "Permit alerts for Grand Canyon. Rim to river.",
    heroDescription: "Mile-deep canyon, desert trails & Colorado River.",
    heroImage: grandCanyonHero,
    pillBg: "#F3EAE5", pillBorder: "#C89A7A", primaryColor: PARK_COLORS.grand_canyon,
  },
  grand_teton: {
    id: "grand_teton",
    name: "Grand Teton National Park",
    shortName: "Grand Teton",
    region: "Wyoming",
    npsCode: "grte",
    tagline: "Permit alerts for Grand Teton. Peaks & alpine lakes.",
    heroDescription: "Jagged peaks, pristine lakes & wild valleys.",
    heroImage: grandTetonHero,
    pillBg: "#E8EDF5", pillBorder: "#94A8CC", primaryColor: PARK_COLORS.grand_teton,
  },
};

/** Icon map for known permit names — fallback to MapPin */
export const PERMIT_ICONS: Record<string, LucideIcon> = {
  "Half Dome": Mountain,
  "Yosemite Wilderness": Trees,
  "Rainier Wilderness": Mountain,
  "Zion Narrows": Waves,
  "Angels Landing (Summer)": Sun,
  "Angels Landing (Fall)": Leaf,
  "Angels Landing (Winter)": Snowflake,
  "Fiery Furnace": Flame,
  "Corridor Backcountry Camping": Tent,
  "Backcountry Camping": Tent,
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
