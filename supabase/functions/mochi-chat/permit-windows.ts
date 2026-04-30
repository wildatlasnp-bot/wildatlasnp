/**
 * Pre-computed permit lottery / reservation windows used by the system
 * prompt so Poko never claims a closed window is upcoming.
 *
 * Pure functions — no Deno, Supabase, or fetch. Safe to import from tests.
 */

export type PermitWindowStatus = "PAST" | "OPEN" | "UPCOMING";

export interface PermitWindow {
  name: string;
  park: string;
  openMonth: number;  // 1-based
  openDay: number;
  closeMonth: number; // 1-based
  closeDay: number;
  nextWindowNote: string;
}

export const KNOWN_PERMIT_WINDOWS: PermitWindow[] = [
  {
    name: "Pre-season lottery",
    park: "Half Dome (Yosemite)",
    openMonth: 3, openDay: 1,
    closeMonth: 3, closeDay: 31,
    nextWindowNote: "March 2027 (dates subject to NPS confirmation)",
  },
  {
    name: "Daily lottery",
    park: "Half Dome (Yosemite)",
    openMonth: 4, openDay: 1,
    closeMonth: 10, closeDay: 31,
    nextWindowNote: "April 2027",
  },
  {
    name: "Pre-season permit lottery",
    park: "Wonderland Trail (Rainier)",
    openMonth: 3, openDay: 1,
    closeMonth: 3, closeDay: 31,
    nextWindowNote: "March 2027 (dates subject to NPS confirmation)",
  },
];

export function getPermitWindowStatus(window: PermitWindow, today: Date): PermitWindowStatus {
  const year = today.getFullYear();
  const open  = new Date(year, window.openMonth - 1,  window.openDay);
  const close = new Date(year, window.closeMonth - 1, window.closeDay, 23, 59, 59);
  if (today > close)  return "PAST";
  if (today >= open)  return "OPEN";
  return "UPCOMING";
}

export function buildPermitWindowSummary(today: Date): string {
  const lines = KNOWN_PERMIT_WINDOWS.map((w) => {
    const year = today.getFullYear();
    const status = getPermitWindowStatus(w, today);
    const closeLabel = `${new Date(year, w.closeMonth - 1, w.closeDay).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
    const openLabel  = `${new Date(year, w.openMonth  - 1, w.openDay ).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
    if (status === "PAST") {
      return `${w.park} — ${w.name}: CLOSED for ${year} (closed ${closeLabel}). Next window: ${w.nextWindowNote}.`;
    }
    if (status === "OPEN") {
      return `${w.park} — ${w.name}: OPEN NOW (closes ${closeLabel}).`;
    }
    return `${w.park} — ${w.name}: UPCOMING (opens ${openLabel}).`;
  });
  return lines.join("\n");
}
