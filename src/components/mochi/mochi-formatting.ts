import React from "react";

/**
 * Formatting + sanitization helpers for Poko/Mochi assistant text.
 *
 * Extracted from MochiChat.tsx to keep the chat shell focused on
 * orchestration. Pure functions only — no React state, no side effects.
 */

export const PERMIT_KEYWORDS = [
  "available", "found", "open", "cancellation", "permit found",
  "spot open", "booking available", "just opened", "grab it",
];

const DISCLAIMER_PERMIT_KW = [
  "lottery", "opens march", "opens april", "permit dates",
  "reservation window", "recreation.gov", "weeks in advance",
  "daily lottery", "pre-season", "walk-up",
];

const DISCLAIMER_TRAIL_KW = [
  "trail is open", "trails are open", "cables are up", "road is open",
  "currently open", "currently closed", "trail conditions", "snow conditions",
];

/** Strip markdown table syntax before rendering — removes any line containing | */
export const stripMarkdownTables = (text: string): string => {
  const lines = text.split('\n');
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    return !trimmed.includes('|') && !/^[-:\s]+$/.test(trimmed);
  });
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Post-process Mochi responses. Returns cleaned text WITHOUT appending
 * disclaimers — disclaimers render as a separate component decided by
 * `shouldShowDisclaimer`.
 */
export function sanitizeMochiResponse(text: string): string {
  if (!text) return text;
  return text;
}

export function shouldShowDisclaimer(text: string): boolean {
  if (!text) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) return false;
  const lower = text.toLowerCase();
  return DISCLAIMER_PERMIT_KW.some((kw) => lower.includes(kw)) ||
    DISCLAIMER_TRAIL_KW.some((kw) => lower.includes(kw));
}

/** Convert inline and line-start bullet patterns using • into proper markdown lists */
export const formatInlineBullets = (text: string): string => {
  let result = text.replace(
    /^(.+?:)\s*•\s*(.+)$/gm,
    (_match, label: string, rest: string) => {
      const items = rest.split(/\s*•\s*/).filter(Boolean);
      if (items.length < 2) return _match;
      return `${label}\n${items.map((item) => `- ${item.trim()}`).join("\n")}`;
    }
  );
  result = result.replace(/^•\s+/gm, "- ");
  return result;
};

/** Strip table elements from markdown — render their text content as inline spans */
export const MARKDOWN_NO_TABLES = {
  table: ({ children }: any) => React.createElement('span', { style: { display: 'block' } }, children),
  thead: () => null,
  tbody: ({ children }: any) => React.createElement('span', { style: { display: 'block' } }, children),
  tr: ({ children }: any) => React.createElement('span', { style: { display: 'block', marginBottom: '2px' } }, children),
  th: ({ children }: any) => React.createElement('strong', null, children, ' '),
  td: ({ children }: any) => React.createElement('span', null, children, ' '),
  hr: () => null,
};
