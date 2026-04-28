/**
 * Visual / data-parity regression tests for DiscoverTips.
 * ----------------------------------------------------------------------------
 * DiscoverTips renders heavily from three data maps keyed by parkId:
 *   - parkHeroes      → hero image, alt text, object-position
 *   - parkHighlights  → 4 highlight cards per park
 *   - parkSeasons     → 4 seasons × 4 tips per park, plus mochiTip
 *
 * The component's UI states (loading skeleton, ready, "From other seasons"
 * fallback toggle, and the "No field tips logged yet" empty state) are all
 * driven by the *shape* of this data. If a future edit removes a tip array,
 * drops a season, deletes a hero, or strips a highlight card, the UI will
 * silently degrade — empty boxes, missing alt text, broken fallback panel.
 *
 * Rather than snapshotting the full ~2000 line component (which depends on
 * Supabase, AuthContext, framer-motion, localStorage, and live time-based
 * memos), we lock in the data contract every park must satisfy. Any future
 * regression — adding a new park, removing a season, blanking out tips —
 * will fail this test with a clear, actionable message.
 */
import { describe, it, expect, vi } from "vitest";

// Vitest's jsdom environment cannot resolve real image asset imports the way
// Vite does at build time, so stub the asset modules pulled in by both the
// component and the parks registry.
vi.mock("@/assets/parks/yosemite-hero.jpg", () => ({ default: "yosemite.jpg" }));
vi.mock("@/assets/parks/zion-hero.jpg", () => ({ default: "zion.jpg" }));
vi.mock("@/assets/parks/grand-canyon-hero.jpg", () => ({ default: "grand-canyon.jpg" }));
vi.mock("@/assets/parks/grand-teton-hero.jpg", () => ({ default: "grand-teton.jpg" }));
vi.mock("@/assets/parks/glacier-hero.jpg", () => ({ default: "glacier.jpg" }));
vi.mock("@/assets/parks/rocky-mountain-hero.jpg", () => ({ default: "rocky-mountain.jpg" }));
vi.mock("@/assets/parks/rainier-hero.jpg", () => ({ default: "rainier.jpg" }));
vi.mock("@/assets/parks/arches-hero.jpg", () => ({ default: "arches.jpg" }));
vi.mock("@/assets/yosemite-hero.jpg", () => ({ default: "yosemite.jpg" }));
vi.mock("@/assets/rainier-hero.jpg", () => ({ default: "rainier.jpg" }));
vi.mock("@/assets/zion-hero.jpg", () => ({ default: "zion.jpg" }));
vi.mock("@/assets/glacier-hero.jpg", () => ({ default: "glacier.jpg" }));
vi.mock("@/assets/rocky-mountain-hero.jpg", () => ({ default: "rocky-mountain.jpg" }));
vi.mock("@/assets/arches-hero.jpg", () => ({ default: "arches.jpg" }));
vi.mock("@/assets/grand-canyon-hero.jpg", () => ({ default: "grand-canyon.jpg" }));
vi.mock("@/assets/grand-teton-hero.jpg", () => ({ default: "grand-teton.jpg" }));

import { ALL_PARK_IDS, PARKS } from "@/lib/parks";
import { parkSeasons, seasons } from "@/lib/park-seasons";
import { parkHeroes, parkHighlights } from "./DiscoverTips";

const EXPECTED_PARKS = [
  "yosemite", "rainier", "zion", "glacier",
  "rocky_mountain", "arches", "grand_canyon", "grand_teton",
];

describe("DiscoverTips — park registry parity", () => {
  it("ALL_PARK_IDS contains exactly the eight supported parks", () => {
    expect(new Set(ALL_PARK_IDS)).toEqual(new Set(EXPECTED_PARKS));
  });

  it.each(EXPECTED_PARKS)("park '%s' has a registry entry with a primaryColor", (id) => {
    const cfg = PARKS[id];
    expect(cfg, `Missing PARKS["${id}"]`).toBeDefined();
    expect(cfg.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(cfg.shortName.length).toBeGreaterThan(0);
  });
});

describe("DiscoverTips — hero image parity", () => {
  it.each(EXPECTED_PARKS)("park '%s' has a hero image, alt text, and objectPosition", (id) => {
    const hero = parkHeroes[id];
    expect(hero, `Missing parkHeroes["${id}"] — Discover hero will render blank`).toBeDefined();
    expect(hero.image, `parkHeroes["${id}"].image is empty`).toBeTruthy();
    // Alt text is required for a11y; an empty alt would silently break SR users.
    expect(hero.alt.trim().length).toBeGreaterThan(10);
    // objectPosition keeps the focal subject visible; default "center" is OK
    // but it must be explicitly set so future edits can't drop it.
    expect(hero.objectPosition).toMatch(/center|top|bottom|\d+%/);
  });
});

describe("DiscoverTips — highlights card parity", () => {
  it.each(EXPECTED_PARKS)("park '%s' has exactly 4 highlight cards", (id) => {
    const cards = parkHighlights[id];
    expect(cards, `Missing parkHighlights["${id}"]`).toBeDefined();
    expect(cards).toHaveLength(4);
  });

  it.each(EXPECTED_PARKS)("park '%s' highlight cards all have icon, title, description", (id) => {
    for (const card of parkHighlights[id]) {
      expect(card.icon).toBeTruthy();
      expect(card.title.trim().length).toBeGreaterThan(0);
      expect(card.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("DiscoverTips — seasonal tip parity (drives Live Alert + fallback states)", () => {
  it.each(EXPECTED_PARKS)("park '%s' has all four seasons populated", (id) => {
    const data = parkSeasons[id];
    expect(data, `Missing parkSeasons["${id}"]`).toBeDefined();
    for (const s of seasons) {
      expect(data[s], `parkSeasons["${id}"].${s} is missing`).toBeDefined();
    }
  });

  it.each(EXPECTED_PARKS)("park '%s' has exactly 4 tips per season with full content", (id) => {
    const data = parkSeasons[id];
    for (const s of seasons) {
      const season = data[s];
      expect(season.label.length).toBeGreaterThan(0);
      expect(season.icon).toBeTruthy();
      expect(season.mochiTip.title.length).toBeGreaterThan(0);
      expect(season.mochiTip.body.length).toBeGreaterThan(0);
      expect(season.tips, `${id}/${s} tips array missing`).toHaveLength(4);
      for (const tip of season.tips) {
        expect(tip.id).toBeGreaterThan(0);
        expect(tip.icon).toBeTruthy();
        expect(tip.title.trim().length).toBeGreaterThan(0);
        expect(tip.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each(EXPECTED_PARKS)(
    "park '%s' has unique tip ids per season (otherwise the Ranger Note jump-link breaks)",
    (id) => {
      for (const s of seasons) {
        const ids = parkSeasons[id][s].tips.map((t) => t.id);
        expect(new Set(ids).size, `${id}/${s} has duplicate tip ids`).toBe(ids.length);
      }
    },
  );
});

describe("DiscoverTips — Live Alert fallback-state coverage", () => {
  /**
   * The "From other seasons" toggle only appears when the *current* season is
   * empty AND another season has tips. The "No field tips logged yet for this
   * park." empty state appears only when EVERY season is empty.
   *
   * As long as every park has tips in every season (asserted above), the
   * normal ready-state path is exercised. These guards make sure we never
   * accidentally ship a park with zero data — which would silently flip the
   * UI into the empty/fallback branch in production.
   */
  it.each(EXPECTED_PARKS)("park '%s' never lands in the global empty state in production data", (id) => {
    const totalTips = seasons.reduce(
      (sum, s) => sum + parkSeasons[id][s].tips.length,
      0,
    );
    expect(totalTips, `Park "${id}" has zero tips across all seasons`).toBeGreaterThan(0);
  });
});
