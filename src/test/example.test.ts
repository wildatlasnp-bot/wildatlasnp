import { describe, it, expect } from "vitest";
import {
  getParkConfig,
  getPermitIcon,
  ALL_PARK_IDS,
  DEFAULT_PARK_ID,
  PARKS,
} from "@/lib/parks";
import { MapPin } from "lucide-react";

describe("getParkConfig", () => {
  it("returns the correct config for a known park", () => {
    const config = getParkConfig("yosemite");
    expect(config.id).toBe("yosemite");
    expect(config.name).toBe("Yosemite National Park");
    expect(config.npsCode).toBe("yose");
  });

  it("falls back to the default park for an unknown park ID", () => {
    const config = getParkConfig("nonexistent_park");
    expect(config.id).toBe(DEFAULT_PARK_ID);
  });

  it("returns rocky_mountain config with underscore ID (not hyphen)", () => {
    const config = getParkConfig("rocky_mountain");
    expect(config.id).toBe("rocky_mountain");
    expect(config.npsCode).toBe("romo");
  });
});

describe("getPermitIcon", () => {
  it("returns the specific icon for a known permit name", () => {
    const icon = getPermitIcon("Half Dome");
    expect(icon).not.toBe(MapPin);
  });

  it("falls back to MapPin for an unknown permit name", () => {
    const icon = getPermitIcon("Unknown Permit XYZ");
    expect(icon).toBe(MapPin);
  });
});

describe("ALL_PARK_IDS", () => {
  it("contains all six parks", () => {
    expect(ALL_PARK_IDS).toHaveLength(6);
  });

  it("every park ID matches its entry key", () => {
    ALL_PARK_IDS.forEach((id) => {
      expect(PARKS[id].id).toBe(id);
    });
  });

  it("uses underscore convention (no hyphens)", () => {
    ALL_PARK_IDS.forEach((id) => {
      expect(id).not.toContain("-");
    });
  });
});
