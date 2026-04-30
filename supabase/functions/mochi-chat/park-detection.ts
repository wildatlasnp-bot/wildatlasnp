/**
 * Detect which park the user is asking about from the most recent user
 * message. Returns null if no known keyword matches. Used to override the
 * client-supplied parkId so a question like "How's Zion today?" answers
 * for Zion even when the user is currently watching a Yosemite permit.
 *
 * Pure function — no I/O. Safe to unit test.
 */

const PARK_KEYWORDS: Record<string, string> = {
  yosemite: "yosemite",
  "half dome": "yosemite",
  "el capitan": "yosemite",
  rainier: "rainier",
  "mount rainier": "rainier",
  "mt rainier": "rainier",
  glacier: "glacier",
  "glacier national": "glacier",
  zion: "zion",
  "angels landing": "zion",
  "the narrows": "zion",
  "rocky mountain": "rocky_mountain",
  rmnp: "rocky_mountain",
  "longs peak": "rocky_mountain",
  arches: "arches",
  "delicate arch": "arches",
  "devils garden": "arches",
  "grand canyon": "grand_canyon",
  "bright angel": "grand_canyon",
  "south kaibab": "grand_canyon",
  "phantom ranch": "grand_canyon",
  "grand teton": "grand_teton",
  "jenny lake": "grand_teton",
  "cascade canyon": "grand_teton",
  "teton crest": "grand_teton",
};

interface ChatMessage {
  role: string;
  content?: string;
}

export function detectParkFromMessage(messages: ChatMessage[]): string | null {
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() ?? "";

  for (const [keyword, parkId] of Object.entries(PARK_KEYWORDS)) {
    if (lastUserMessage.includes(keyword)) {
      return parkId;
    }
  }
  return null;
}
