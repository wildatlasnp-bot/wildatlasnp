/**
 * Time-aware greeting + idle/returning personality copy for Poko.
 *
 * Extracted from MochiChat.tsx — pure helpers only. The session-storage
 * cycling for idle messages still lives in the chat component because it
 * shares state with the message list.
 */

export type DispatchWindow = "early" | "morning" | "midday" | "evening" | "night";

export const maskPhone = (phone: string): string => {
  if (!phone) return "your phone";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(***) ***-****";
  return `(***) ***-${digits.slice(-4)}`;
};

/** Time-of-day phrase for greeting (legacy — used for non-dispatch copy) */
export const getTimePeriod = (): { label: string; casual: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { label: "Good morning", casual: "this morning" };
  if (hour >= 12 && hour < 17) return { label: "Good afternoon", casual: "this afternoon" };
  if (hour >= 17 && hour < 21) return { label: "Good evening", casual: "tonight" };
  return { label: "Hey", casual: "tonight" };
};

/** Time-aware dispatch windows for the Poko briefing card.
    Selects from 5 windows based on the user's local hour. Park name is
    woven into title/body so the greeting feels like Poko has been paying
    attention. Returns a stable `key` so callers can detect window changes
    and crossfade between messages without re-animating identical copy. */
export const getDispatchWindow = (parkName: string | null): {
  key: DispatchWindow;
  title: string;
  body: string;
} => {
  const hour = new Date().getHours();
  const hasPark = !!parkName;
  if (!hasPark) {
    return {
      key: hour >= 5 && hour < 9 ? "early"
        : hour >= 9 && hour < 12 ? "morning"
        : hour >= 12 && hour < 17 ? "midday"
        : hour >= 17 && hour < 21 ? "evening"
        : "night",
      title: "Poko's ready.",
      body: "Add a park to start watching.",
    };
  }
  if (hour >= 5 && hour < 9) {
    return {
      key: "early",
      title: "Early start.",
      body: `Best window for ${parkName} cancellations right now. Most hikers are still asleep.`,
    };
  }
  if (hour >= 9 && hour < 12) {
    return {
      key: "morning",
      title: "Peak hours building.",
      body: `Crowds are filling in around ${parkName}. Poko's scanning every 2 minutes — cancellations still surface.`,
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      key: "midday",
      title: "Midday watch.",
      body: `High traffic at ${parkName}. Cancellations happen anytime — often when plans change last minute.`,
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      key: "evening",
      title: "Evening turnover.",
      body: `Second quiet window opening at ${parkName}. Cancellations often appear as tomorrow's plans shift.`,
    };
  }
  return {
    key: "night",
    title: "Night watch.",
    body: `Poko's on ${parkName} — won't miss a thing. Early morning is peak cancellation territory.`,
  };
};

/* ── POKO PERSONALITY LAYER ─────────────────────────────────────────
   Idle dispatch rotation: after 3 minutes of dwelling on the Poko tab
   without sending, the briefing prose cycles through these one-liners.
   Cycle is non-repeating until exhausted, then reshuffles. Stored on
   sessionStorage so it survives tab switches within a session.
   Copy is FINAL — do not paraphrase per spec. */
export const IDLE_MESSAGES = [
  "Still here. Still watching.",
  "Quiet out there. Good time to plan.",
  "Poko hasn't blinked.",
  "Permits move fast. So does Poko.",
  "No news is Poko working.",
  "The trail is patient. So is Poko.",
  "Watching. Always watching.",
  "Every scan is another chance.",
];

/* Returning-user greetings — shown for 4s when last_seen_at > 24h ago,
   then crossfade to the standard time-aware dispatch. Selected at random;
   spec is final copy. */
export const RETURNING_MESSAGES = [
  "Welcome back. Poko kept watch.",
  "You were gone. Poko wasn't.",
  "Back on the trail.",
  "Poko's been busy while you were away.",
];

/* Seasonal subtitle — appears as a quiet 12px italic line beneath the
   standard time-aware greeting. Hidden during idle / returning / first-
   session states so it never competes with personality moments. */
export const getSeasonalSubtitle = (now: Date = new Date()): string => {
  const m = now.getMonth();
  const d = now.getDate();
  if ((m === 2 && d >= 20) || m === 3 || m === 4 || (m === 5 && d <= 20)) {
    return "Spring permits move fast. Peak season is weeks away.";
  }
  if ((m === 5 && d >= 21) || m === 6 || m === 7 || (m === 8 && d <= 22)) {
    return "Peak season. Every cancellation matters.";
  }
  if ((m === 8 && d >= 23) || m === 9 || m === 10 || (m === 11 && d <= 20)) {
    return "Fall shoulder season. Hidden gems opening up.";
  }
  return "Off-season. Plan now, beat the spring rush.";
};

/* Marker prefix used in the briefing message content so the renderer
   knows to suppress the seasonal subtitle and treat the body as a
   personality moment (idle / returning). The marker is stripped before
   display. Using a non-printable sentinel keeps it invisible to AI. */
export const PERSONALITY_MARKER = "\u200BPOKO_PERSONALITY\u200B";
