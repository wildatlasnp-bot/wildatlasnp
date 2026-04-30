/**
 * Emergency intercept for the mochi-chat edge function.
 *
 * If the user's message contains an emergency keyword, we bypass the LLM
 * and return a deterministic SSE-formatted response that surfaces the
 * 911 instruction plus park-specific dispatch numbers. This guarantees
 * a fast, accurate, life-safety response that cannot be derailed by a
 * model error, rate limit, or upstream outage.
 */

export const EMERGENCY_KEYWORDS = [
  "injured", "injury", "emergency",
  "can't move", "unconscious", "bleeding",
  "hypothermia", "heart attack", "chest pain", "drowning",
  "i fell", "have fallen", "can't breathe", "trapped",
];

export const PARK_EMERGENCY: Record<string, string> = {
  yosemite:        "Yosemite: 209-379-3119",
  zion:            "Zion: 435-772-3322",
  grand_canyon:    "Grand Canyon: 928-638-7805",
  grand_teton:     "Grand Teton: 307-739-3301",
  glacier:         "Glacier: 406-888-7800",
  "rocky-mountain": "Rocky Mountain: 970-586-1203",
  rocky_mountain:  "Rocky Mountain: 970-586-1203",
  rainier:         "Rainier: 360-569-2211",
  arches:          "Arches: 435-719-2299",
};

export function isEmergency(text: string): boolean {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Build the human-readable emergency reply (plain text — caller wraps in SSE). */
export function buildEmergencyText(parkId: string | null | undefined): string {
  const normalizedPark = (parkId ?? "").toLowerCase().replace(/\s+/g, "-");
  const primaryLine = PARK_EMERGENCY[normalizedPark];
  const otherLines = Object.values(PARK_EMERGENCY)
    .filter((v) => v !== primaryLine)
    .join("\n");
  return primaryLine
    ? `This sounds like an emergency. Call 911 immediately.\n\n${primaryLine} ← your park\n\nOther park lines:\n${otherLines}`
    : `This sounds like an emergency. Call 911 immediately.\n\nPark emergency lines:\n${Object.values(PARK_EMERGENCY).join("\n")}`;
}

/** Stream the emergency text as a single SSE chunk + DONE marker. */
export function buildEmergencyStream(parkId: string | null | undefined): ReadableStream<Uint8Array> {
  const text = buildEmergencyText(parkId);
  const encoder = new TextEncoder();
  const chunk =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text }, index: 0, finish_reason: null }] })}\n\n` +
    `data: [DONE]\n\n`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}
