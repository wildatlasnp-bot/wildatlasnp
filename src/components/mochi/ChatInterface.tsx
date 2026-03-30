/**
 * Intent-driven suggestion chip engine for Mochi chat.
 *
 * Analyses Mochi's last reply + the user's active watches to produce
 * exactly 3 next-action chips that feel contextual, never generic.
 */

import { BarChart3, Leaf, Clock, Mountain, Compass, Shield } from "lucide-react";
import { PARKS } from "@/lib/parks";

/* ── Types ─────────────────────────────────────────────────── */

export type ChipIcon = typeof BarChart3;
export interface SuggestedChip {
  label: string;
  descriptor: string;
  icon: ChipIcon;
}

export interface UserWatch {
  park_id: string;
  permit_name: string;
}

/* ── Intent detection ──────────────────────────────────────── */

type Intent =
  | "weather"
  | "permits"
  | "cancellation"
  | "crowds"
  | "trails"
  | "camping"
  | "wildlife"
  | "general";

const INTENT_PATTERNS: [Intent, RegExp][] = [
  ["weather",      /\b(weather|temperature|rain|snow|forecast|wind|storm|degrees|cold|warm|sunshine|packing)\b/i],
  ["permits",      /\b(permit|reservation|rec\.gov|recreation\.gov|lottery|booking|available|slot|spot)\b/i],
  ["cancellation", /\b(cancel|cancellation|drop|release|open up|freed|freed up|snag|grab)\b/i],
  ["crowds",       /\b(crowd|busy|packed|quiet|manageable|wait time|peak hour|parking|shuttle)\b/i],
  ["trails",       /\b(trail|hike|hiking|route|trailhead|summit|elevation|switchback|loop|mile)\b/i],
  ["camping",      /\b(camp|campsite|campground|tent|rv|backcountry camp)\b/i],
  ["wildlife",     /\b(bear|wildlife|animal|elk|deer|moose|bird|marmot)\b/i],
];

const detectIntent = (text: string): Intent => {
  let best: Intent = "general";
  let bestCount = 0;
  for (const [intent, pattern] of INTENT_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches && matches.length > bestCount) {
      bestCount = matches.length;
      best = intent;
    }
  }
  return best;
};

/* ── Park detection ────────────────────────────────────────── */

const detectParkInText = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const park of Object.values(PARKS)) {
    if (park.shortName && lower.includes(park.shortName.toLowerCase())) {
      return park.shortName;
    }
    if (lower.includes(park.name.toLowerCase())) {
      return park.shortName ?? park.name;
    }
  }
  return null;
};

const detectParkId = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const [id, park] of Object.entries(PARKS)) {
    if (park.shortName && lower.includes(park.shortName.toLowerCase())) return id;
    if (lower.includes(park.name.toLowerCase())) return id;
  }
  return null;
};

/* ── Intent → chip templates ───────────────────────────────── */

const ICON_POOL: ChipIcon[] = [BarChart3, Leaf, Clock, Mountain, Compass, Shield];

const chip = (label: string, descriptor: string, iconIdx = 0): SuggestedChip => ({
  label,
  descriptor,
  icon: ICON_POOL[iconIdx % ICON_POOL.length],
});

/**
 * Primary API — returns exactly 3 chips based on intent analysis.
 *
 * @param lastMochiMessage  The most recent assistant message text
 * @param userWatches       The user's active watch list (park_id + permit_name)
 * @param currentParkName   Optional current park context from page/selector
 */
export function getSuggestedChips(
  lastMochiMessage: string,
  userWatches: UserWatch[],
  currentParkName?: string | null,
): SuggestedChip[] {
  if (!lastMochiMessage?.trim()) return [];

  const intent = detectIntent(lastMochiMessage);
  const mentionedPark = detectParkInText(lastMochiMessage);
  const mentionedParkId = detectParkId(lastMochiMessage);

  // Resolve park context: mentioned park > current page park
  const parkName = mentionedPark ?? currentParkName ?? null;

  // Check if the mentioned park is already in the user's watch list
  const isTracked =
    mentionedParkId != null &&
    userWatches.some((w) => w.park_id === mentionedParkId);

  const watchedPermitForPark = mentionedParkId
    ? userWatches.find((w) => w.park_id === mentionedParkId)?.permit_name
    : null;

  const result: SuggestedChip[] = [];

  // ── Priority logic by intent ────────────────────────────

  switch (intent) {
    case "weather":
      result.push(
        chip(parkName ? `${parkName} permits` : "Check permits", "What's available?", 0),
        chip(parkName ? `Best time for ${parkName}` : "Best time to visit", "When should I go?", 2),
        chip(parkName ? `${parkName} trails` : "Trail picks", "Show me options", 1),
      );
      break;

    case "permits":
      result.push(
        chip(
          parkName ? `${parkName} permit odds` : "Live permit odds",
          "What are my chances?",
          0,
        ),
        chip("Check availability", "Any open dates?", 2),
        chip(parkName ? `${parkName} crowds` : "Crowd level", "How busy is it?", 3),
      );
      break;

    case "cancellation":
      if (isTracked && watchedPermitForPark) {
        result.push(
          chip(`View ${parkName ?? "park"} odds`, "How's it looking?", 0),
          chip("Best check times", "When to refresh?", 2),
          chip(parkName ? `${parkName} trails` : "Trail picks", "Plan the hike", 1),
        );
      } else {
        result.push(
          chip(parkName ? `Set ${parkName} alert` : "Set alert", "Get notified instantly", 5),
          chip("Cancellation tips", "How to snag one", 0),
          chip(parkName ? `${parkName} availability` : "Check availability", "Open dates?", 2),
        );
      }
      break;

    case "crowds":
      result.push(
        chip(parkName ? `${parkName} trails` : "Trail picks", "Best routes", 1),
        chip(parkName ? `${parkName} permits` : "Permit tips", "How to get one", 0),
        chip(parkName ? `${parkName} weather` : "Weather outlook", "What's the forecast?", 2),
      );
      break;

    case "trails":
      result.push(
        chip(parkName ? `${parkName} weather` : "Weather outlook", "Pack accordingly", 2),
        chip(parkName ? `${parkName} crowds` : "Crowd level", "How busy?", 3),
        chip(parkName ? `${parkName} wildlife` : "Wildlife spots", "What might I see?", 4),
      );
      break;

    case "camping":
      result.push(
        chip(parkName ? `${parkName} permits` : "Camp permits", "How do I book?", 0),
        chip(parkName ? `${parkName} weather` : "Weather outlook", "Plan for conditions", 2),
        chip(parkName ? `${parkName} trails` : "Nearby trails", "What's close by?", 1),
      );
      break;

    case "wildlife":
      result.push(
        chip(parkName ? `${parkName} trails` : "Trail picks", "Best routes", 1),
        chip(parkName ? `${parkName} weather` : "Weather outlook", "Conditions", 2),
        chip("Safety tips", "What should I know?", 5),
      );
      break;

    default: {
      // General — use park-specific chips if park context exists
      if (parkName) {
        result.push(
          chip(`${parkName} permits`, "Check availability", 0),
          chip(`${parkName} crowds`, "How busy?", 3),
          chip(`${parkName} trails`, "Show me options", 1),
        );
      } else {
        result.push(
          chip("Check permits", "What's available?", 0),
          chip("Crowd level", "How busy is it?", 3),
          chip("Trail picks", "Show me options", 1),
        );
      }
      break;
    }
  }

  return result.slice(0, 3);
}
