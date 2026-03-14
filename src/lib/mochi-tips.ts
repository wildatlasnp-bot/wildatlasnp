/**
 * Date-aware Mochi tips for the Discover screen.
 *
 * Each tip has a date window (startDate–endDate in MM-DD format for annual
 * recurrence) and a priority. The highest-priority tip whose window contains
 * today is shown. If nothing matches, a per-park fallback is used.
 */

export interface MochiTip {
  id: string;
  park: string;
  title: string;
  text: string;
  /** MM-DD — inclusive start of the annual window */
  startDate: string;
  /** MM-DD — inclusive end (may wrap past Dec 31) */
  endDate: string;
  /** Higher number = higher priority */
  priority: number;
}

// ── Tip catalogue ──────────────────────────────────────────────

export const mochiTips: MochiTip[] = [
  // ── Yosemite ──
  {
    id: "yos-firefall",
    park: "yosemite",
    title: "🔥 Firefall Season",
    text: "Firefall season peaks in mid-February at Horsetail Fall. Arrive by 4 PM for a spot at El Capitan Picnic Area — parking fills fast.",
    startDate: "01-25",
    endDate: "02-25",
    priority: 10,
  },
  {
    id: "yos-waterfalls",
    park: "yosemite",
    title: "💧 Peak Waterfall Season",
    text: "Spring snowmelt makes Yosemite waterfalls thunderous. May is peak flow — Yosemite Falls and Bridalveil Veil are at their most dramatic.",
    startDate: "03-01",
    endDate: "06-15",
    priority: 5,
  },
  {
    id: "yos-summer-parking",
    park: "yosemite",
    title: "🚗 Summer Parking Crunch",
    text: "Valley lots fill by 8:30 AM on weekends. Enter before 7:30 AM or take YARTS from Merced. Half Dome permits are required.",
    startDate: "06-16",
    endDate: "09-05",
    priority: 5,
  },
  {
    id: "yos-fall-quiet",
    park: "yosemite",
    title: "🍂 Fall Serenity",
    text: "Crowds thin dramatically after Labor Day. Midweek visits mean near-empty trails and cozy lodges. Book the Ahwahnee now!",
    startDate: "09-06",
    endDate: "11-15",
    priority: 5,
  },
  {
    id: "yos-winter-chains",
    park: "yosemite",
    title: "❄️ Winter Chains Required",
    text: "Snow chains are required on Hwy 41 and 140 Nov–April. Tioga Road is closed. The Valley is serene and uncrowded.",
    startDate: "11-16",
    endDate: "01-24",
    priority: 5,
  },

  // ── Rainier ──
  {
    id: "rai-spring-snow",
    park: "rainier",
    title: "🏔️ Spring Snow Advisory",
    text: "Snow still blankets higher elevations through June. Paradise road may be closed weekdays — check WSDOT alerts before driving up.",
    startDate: "03-01",
    endDate: "06-15",
    priority: 5,
  },
  {
    id: "rai-summer-wonderland",
    park: "rainier",
    title: "🥾 Wonderland Trail Season",
    text: "Wonderland Trail permits sell out in minutes. Wilderness permits are required May 15–Oct 15. Camp Muir fills fast on clear weekends.",
    startDate: "06-16",
    endDate: "09-15",
    priority: 5,
  },
  {
    id: "rai-fall-larch",
    park: "rainier",
    title: "🌿 Larch Season",
    text: "September is Rainier's secret weapon — clear skies, thin crowds, and stunning larch trees turning gold at higher elevations.",
    startDate: "09-16",
    endDate: "10-31",
    priority: 5,
  },
  {
    id: "rai-winter-snow",
    park: "rainier",
    title: "❄️ Epic Snowfall",
    text: "Paradise averages 640 inches of snow per year. Only the Nisqually entrance to Paradise is open. Tire chains required.",
    startDate: "11-01",
    endDate: "02-28",
    priority: 5,
  },

  // ── Zion ──
  {
    id: "zion-spring-runoff",
    park: "zion",
    title: "💧 Spring Runoff Alert",
    text: "Spring runoff makes the Narrows impassable in April–May. Check Virgin River flow rates at the visitor center before canyon hikes.",
    startDate: "03-01",
    endDate: "05-31",
    priority: 5,
  },
  {
    id: "zion-summer-heat",
    park: "zion",
    title: "🌡️ Extreme Heat Warning",
    text: "Temperatures exceed 105°F in the canyon. Carry 1 liter of water per hour. Flash flood risk peaks July–September.",
    startDate: "06-01",
    endDate: "09-15",
    priority: 5,
  },
  {
    id: "zion-fall-sweet-spot",
    park: "zion",
    title: "🍂 Zion's Sweet Spot",
    text: "October–November is ideal — cooler temps, fall cottonwoods, and the Narrows at perfect flow. Crowds drop 40% after Labor Day.",
    startDate: "09-16",
    endDate: "11-30",
    priority: 5,
  },
  {
    id: "zion-winter-drive",
    park: "zion",
    title: "🚗 Drive Scenic Drive",
    text: "No shuttle December–February — you can drive the full Scenic Drive. Angels Landing chains ice over; micro-spikes essential.",
    startDate: "12-01",
    endDate: "02-28",
    priority: 5,
  },

  // ── Glacier ──
  {
    id: "gla-spring-road",
    park: "glacier",
    title: "🚧 Road Closures",
    text: "Going-to-the-Sun Road won't fully open until late June or early July. Lower elevation trails around Lake McDonald are your best bet.",
    startDate: "03-01",
    endDate: "06-20",
    priority: 5,
  },
  {
    id: "gla-summer-reservations",
    park: "glacier",
    title: "🎫 Vehicle Reservations Required",
    text: "Vehicle reservations required for Going-to-the-Sun Road 6 AM–3 PM. Book at recreation.gov — they sell out in minutes.",
    startDate: "06-21",
    endDate: "09-08",
    priority: 5,
  },
  {
    id: "gla-fall-larch",
    park: "glacier",
    title: "🌿 Larch Season",
    text: "Larch trees turn gold in late September. Going-to-the-Sun Road closes mid-October — last chance for the drive.",
    startDate: "09-09",
    endDate: "10-20",
    priority: 5,
  },
  {
    id: "gla-winter-access",
    park: "glacier",
    title: "❄️ Limited Winter Access",
    text: "Most of Glacier is inaccessible in winter. Only the Apgar area is plowed. Cross-country skiing and snowshoeing are world-class.",
    startDate: "10-21",
    endDate: "02-28",
    priority: 5,
  },

  // ── Rocky Mountain ──
  {
    id: "rmnp-spring-road",
    park: "rocky_mountain",
    title: "🛣️ Trail Ridge Road Opening",
    text: "Trail Ridge Road usually opens Memorial Day weekend. Lower elevations like Moraine Park are accessible and teeming with elk calves.",
    startDate: "03-01",
    endDate: "06-01",
    priority: 5,
  },
  {
    id: "rmnp-summer-entry",
    park: "rocky_mountain",
    title: "🎫 Timed Entry Required",
    text: "Timed entry reservations required. Afternoon thunderstorms hit like clockwork — be below treeline by noon.",
    startDate: "06-02",
    endDate: "09-05",
    priority: 5,
  },
  {
    id: "rmnp-elk-rut",
    park: "rocky_mountain",
    title: "🦌 Elk Rut Season",
    text: "Elk rut in September is RMNP's signature event. Bulls bugle at dawn and dusk in Moraine Park. Stay in your car — they're unpredictable.",
    startDate: "09-06",
    endDate: "10-15",
    priority: 8,
  },
  {
    id: "rmnp-winter",
    park: "rocky_mountain",
    title: "❄️ Winter Wonderland",
    text: "Trail Ridge Road closes Oct–Memorial Day. Bear Lake Road stays open but requires 4WD/chains after storms. Snowshoeing to Emerald Lake is magical.",
    startDate: "10-16",
    endDate: "02-28",
    priority: 5,
  },

  // ── Arches ──
  {
    id: "arch-spring-entry",
    park: "arches",
    title: "🎫 Timed Entry Season",
    text: "Spring is Arches' most popular season — timed entry is required April–October. Temps are perfect (60s–80s) but Delicate Arch at sunset draws hundreds.",
    startDate: "03-15",
    endDate: "05-31",
    priority: 5,
  },
  {
    id: "arch-summer-heat",
    park: "arches",
    title: "🔥 Extreme Slickrock Heat",
    text: "Surface temps on slickrock exceed 140°F. Carry 2+ liters of water for any hike. Delicate Arch has zero shade — hike at sunrise or sunset only.",
    startDate: "06-01",
    endDate: "09-15",
    priority: 5,
  },
  {
    id: "arch-fall-best",
    park: "arches",
    title: "🍂 Peak Fall Season",
    text: "October is Arches at its best — timed entry ends November 1, temps cool to the 70s, and fall light paints the red rock in deep amber.",
    startDate: "09-16",
    endDate: "11-01",
    priority: 5,
  },
  {
    id: "arch-winter-free",
    park: "arches",
    title: "❄️ No Reservations Needed",
    text: "No timed entry required November–March! Snow-dusted arches are rare and breathtaking. Roads can ice over — check conditions.",
    startDate: "11-02",
    endDate: "03-14",
    priority: 5,
  },
];

// ── Per-park fallback tips ──────────────────────────────────────

const fallbackTips: Record<string, { title: string; text: string }> = {
  yosemite: {
    title: "🐻 Mochi's Tip",
    text: "Spring is a time of transition in Yosemite Valley. Check the Trail Conditions below before heading to higher elevations.",
  },
  rainier: {
    title: "🐻 Mochi's Tip",
    text: "Conditions at Rainier change fast with elevation. Check road and trail status before heading up — Paradise can differ wildly from Longmire.",
  },
  zion: {
    title: "🐻 Mochi's Tip",
    text: "Zion's canyon weather can surprise you. Check the Virgin River flow and trail conditions at the visitor center before starting your hike.",
  },
  glacier: {
    title: "🐻 Mochi's Tip",
    text: "Glacier conditions vary dramatically by season. Check Going-to-the-Sun Road status and bear activity reports before planning your route.",
  },
  rocky_mountain: {
    title: "🐻 Mochi's Tip",
    text: "Rocky Mountain weather shifts quickly above treeline. Check Trail Ridge Road conditions and carry layers — temps can swing 30°F in an hour.",
  },
  arches: {
    title: "🐻 Mochi's Tip",
    text: "Arches' desert conditions demand preparation. Bring more water than you think, wear sun protection, and check for timed entry requirements.",
  },
};

const DEFAULT_FALLBACK = {
  title: "🐻 Mochi's Tip",
  text: "Check current park conditions before heading out. Trail status, weather, and crowd levels can change quickly.",
};

// ── Selection logic ─────────────────────────────────────────────

/**
 * Returns today's date as MM-DD.
 */
function todayMMDD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/**
 * Check if `today` (MM-DD) falls within a [start, end] window.
 * Handles year-wrapping windows (e.g. 11-16 → 01-24).
 */
function isInWindow(today: string, start: string, end: string): boolean {
  if (start <= end) {
    // Normal window: e.g. 03-01 → 06-15
    return today >= start && today <= end;
  }
  // Wrapping window: e.g. 11-16 → 01-24
  return today >= start || today <= end;
}

/**
 * Get the best Mochi tip for a park on the current date.
 * Returns { title, text } matching the highest-priority active tip,
 * or the park fallback if nothing matches.
 */
export function getActiveMochiTip(parkId: string): { title: string; text: string } {
  const today = todayMMDD();

  const matching = mochiTips
    .filter((tip) => tip.park === parkId && isInWindow(today, tip.startDate, tip.endDate))
    .sort((a, b) => b.priority - a.priority);

  if (matching.length > 0) {
    return { title: matching[0].title, text: matching[0].text };
  }

  return fallbackTips[parkId] ?? DEFAULT_FALLBACK;
}
