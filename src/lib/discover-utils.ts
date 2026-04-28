// Discover-page utilities: time-of-day computations, sun ephemeris, photo grading.
// Pure functions — no React, no side effects. Safe to import anywhere.

export interface ParkLocation {
  tz: string;
  lat: number;
  lon: number;
}

// Park metadata for sun calculations and timezone-aware insights.
// Lat/lon = visitor center / canonical landmark coordinates.
export const PARK_LOCATIONS: Record<string, ParkLocation> = {
  yosemite:       { tz: "America/Los_Angeles", lat: 37.8651, lon: -119.5383 },
  rainier:        { tz: "America/Los_Angeles", lat: 46.8523, lon: -121.7603 },
  zion:           { tz: "America/Denver",      lat: 37.2982, lon: -113.0263 },
  glacier:        { tz: "America/Denver",      lat: 48.7596, lon: -113.7870 },
  rocky_mountain: { tz: "America/Denver",      lat: 40.3428, lon: -105.6836 },
  arches:         { tz: "America/Denver",      lat: 38.7331, lon: -109.5925 },
  grand_canyon:   { tz: "America/Phoenix",     lat: 36.0544, lon: -112.1401 },
  grand_teton:    { tz: "America/Denver",      lat: 43.7904, lon: -110.6818 },
};

export function getParkLocation(parkId: string): ParkLocation {
  return PARK_LOCATIONS[parkId] ?? PARK_LOCATIONS.yosemite;
}

/** Returns the local time at a park as { hour, minute, weekday, dateLabel } */
export function getParkLocalTime(parkId: string, when: Date = new Date()) {
  const tz = getParkLocation(parkId).tz;
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(when);

  const hour = parseInt(fmt({ hour: "numeric", hour12: false }), 10);
  const minute = parseInt(fmt({ minute: "numeric" }), 10);
  const weekday = fmt({ weekday: "short" }); // Mon, Tue...
  const dateLabel = fmt({ month: "short", day: "numeric" }); // Apr 28
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(when); // YYYY-MM-DD
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  return { hour, minute, weekday, dateLabel, isoDate, isWeekend, tz };
}

/**
 * NOAA-style sunrise/sunset calculation.
 * Returns the sunrise and sunset (as UTC Date instants) for the *local civil date*
 * at the given lat/lon/timezone that contains the supplied moment.
 * Accuracy ~1–2 minutes — fine for editorial display, not for navigation.
 */
function toJulian(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

/** Returns the YYYY-MM-DD civil date in the given timezone for a moment. */
function civilDateInTz(when: Date, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return { y: parseInt(map.year, 10), m: parseInt(map.month, 10), d: parseInt(map.day, 10) };
}

function solarTimesForDate(
  lat: number,
  lon: number,
  y: number,
  m: number,
  d: number,
): { sunrise: Date; sunset: Date } {
  // Use UTC noon of the local civil date as the anchor — guarantees we land on the
  // correct local day regardless of the observer's timezone offset.
  const anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  const J = toJulian(anchorMs);
  const n = Math.round(J - 2451545.0 + 0.0008 - lon / 360);
  const Jstar = n + 0.0009 - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mrad = (M * Math.PI) / 180;
  const C =
    1.9148 * Math.sin(Mrad) + 0.0200 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = (lambda * Math.PI) / 180;
  const Jtransit =
    2451545.0 + Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);
  const declination = Math.asin(
    Math.sin(lambdaRad) * Math.sin((23.44 * Math.PI) / 180),
  );
  const latRad = (lat * Math.PI) / 180;
  const cosH =
    (Math.sin((-0.83 * Math.PI) / 180) - Math.sin(latRad) * Math.sin(declination)) /
    (Math.cos(latRad) * Math.cos(declination));

  const transitMs = (Jtransit - 2440587.5) * 86400000;
  if (cosH > 1) {
    // Polar night
    return { sunrise: new Date(transitMs), sunset: new Date(transitMs) };
  }
  if (cosH < -1) {
    // Polar day
    return { sunrise: new Date(transitMs), sunset: new Date(transitMs) };
  }
  const H = Math.acos(cosH) * (180 / Math.PI);
  const Jset = Jtransit + H / 360;
  const Jrise = 2 * Jtransit - Jset; // symmetric around solar noon
  return {
    sunrise: new Date((Jrise - 2440587.5) * 86400000),
    sunset: new Date((Jset - 2440587.5) * 86400000),
  };
}

function solarTimes(
  lat: number,
  lon: number,
  when: Date,
  tz: string,
): { sunrise: Date; sunset: Date } {
  const { y, m, d } = civilDateInTz(when, tz);
  return solarTimesForDate(lat, lon, y, m, d);
}

export interface SunEphemeris {
  sunrise: Date;
  sunset: Date;
  /** "DAWN" | "DAY" | "DUSK" | "NIGHT" */
  phase: "DAWN" | "DAY" | "DUSK" | "NIGHT";
  /** Minutes until next sun event (sunrise or sunset), or null if unknown. */
  minutesToNextEvent: number | null;
  /** Label for the next event ("Sunrise" or "Sunset") */
  nextEventLabel: "Sunrise" | "Sunset" | null;
  /** Formatted local-time strings, e.g. "6:42a" */
  sunriseLabel: string;
  sunsetLabel: string;
}

function fmtTimeShort(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  let h = "", m = "", ap = "";
  for (const p of parts) {
    if (p.type === "hour") h = p.value;
    if (p.type === "minute") m = p.value;
    if (p.type === "dayPeriod") ap = p.value.toLowerCase().replace("m", "");
  }
  return `${h}:${m}${ap}`;
}

export function getSunEphemeris(parkId: string, when: Date = new Date()): SunEphemeris {
  const { lat, lon, tz } = getParkLocation(parkId);
  const { sunrise, sunset } = solarTimes(lat, lon, when);
  const now = when.getTime();
  const dawnThreshold = sunrise.getTime() + 30 * 60_000; // 30 min after sunrise = day
  const duskThreshold = sunset.getTime() - 30 * 60_000; // 30 min before sunset = dusk start

  let phase: SunEphemeris["phase"];
  let minutesToNextEvent: number | null;
  let nextEventLabel: SunEphemeris["nextEventLabel"];

  if (now < sunrise.getTime() - 30 * 60_000) {
    phase = "NIGHT";
    minutesToNextEvent = Math.round((sunrise.getTime() - now) / 60_000);
    nextEventLabel = "Sunrise";
  } else if (now < dawnThreshold) {
    phase = "DAWN";
    minutesToNextEvent = Math.round((sunrise.getTime() - now) / 60_000);
    nextEventLabel = "Sunrise";
  } else if (now < duskThreshold) {
    phase = "DAY";
    minutesToNextEvent = Math.round((sunset.getTime() - now) / 60_000);
    nextEventLabel = "Sunset";
  } else if (now < sunset.getTime() + 30 * 60_000) {
    phase = "DUSK";
    minutesToNextEvent = Math.round((sunset.getTime() - now) / 60_000);
    nextEventLabel = minutesToNextEvent > 0 ? "Sunset" : null;
  } else {
    phase = "NIGHT";
    // Compute tomorrow's sunrise
    const tomorrow = new Date(when.getTime() + 24 * 60 * 60 * 1000);
    const { sunrise: nextSunrise } = solarTimes(lat, lon, tomorrow);
    minutesToNextEvent = Math.round((nextSunrise.getTime() - now) / 60_000);
    nextEventLabel = "Sunrise";
  }

  return {
    sunrise,
    sunset,
    phase,
    minutesToNextEvent,
    nextEventLabel,
    sunriseLabel: fmtTimeShort(sunrise, tz),
    sunsetLabel: fmtTimeShort(sunset, tz),
  };
}

/**
 * Returns a CSS filter string that color-grades the hero image for the current sun phase.
 * Pure CSS, GPU-accelerated. The image itself is unchanged.
 */
export function getPhotoGradeFilter(phase: SunEphemeris["phase"]): string {
  switch (phase) {
    case "DAWN":
      // Warm rose, slightly desaturated, gently lifted shadows
      return "saturate(0.92) brightness(0.94) sepia(0.18) hue-rotate(-8deg)";
    case "DAY":
      return "saturate(1.0) brightness(1.0)";
    case "DUSK":
      // Golden hour: warm, saturated, slightly darker
      return "saturate(1.18) brightness(0.92) sepia(0.22) hue-rotate(-12deg)";
    case "NIGHT":
      // Cool blue cast, darker, lower saturation
      return "saturate(0.7) brightness(0.55) hue-rotate(8deg) contrast(1.05)";
  }
}

/**
 * Returns an overlay color (placed on top of the image) reinforcing the current phase.
 * Use as a 2nd-layer scrim above the photo grade.
 */
export function getPhotoOverlayColor(phase: SunEphemeris["phase"]): string {
  switch (phase) {
    case "DAWN":
      return "linear-gradient(to bottom, rgba(255,200,170,0.10) 0%, transparent 40%, rgba(0,0,0,0.30) 100%)";
    case "DAY":
      return "linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%)";
    case "DUSK":
      return "linear-gradient(to bottom, rgba(255,150,80,0.18) 0%, transparent 35%, rgba(40,20,10,0.45) 100%)";
    case "NIGHT":
      return "linear-gradient(to bottom, rgba(15,30,60,0.30) 0%, rgba(0,0,0,0.55) 100%)";
  }
}

/** Format minutes as "Xh Ym" or "Xm" — for countdowns. */
export function formatCountdown(mins: number | null): string {
  if (mins === null || mins < 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format coordinate as "37.8651° N · 119.5383° W" — for hero wordmark. */
export function formatCoordinates(parkId: string): string {
  const { lat, lon } = getParkLocation(parkId);
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir} · ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}
