/**
 * Shared visual tokens for Poko chat surfaces.
 *
 * Single source of truth for bubble colors, radii, shadows, borders and the
 * typing-indicator dots. Consumed by:
 *   - Assistant (Poko) bubbles
 *   - Initial briefing bubble (Poko, slightly different bg + radius)
 *   - User bubbles
 *   - Typing indicator bubble + dots
 *
 * Edit values here to retheme all three surfaces in lockstep.
 */

import type { CSSProperties } from "react";

/* ---------- Raw color tokens ---------- */
export const POKO_COLORS = {
  // Poko (assistant) — warm cream-tinted white
  pokoBg: "#FDFBF8",
  pokoBgBriefing: "linear-gradient(180deg, #FDFBF8 0%, #F6F1E8 100%)",
  pokoAccentBorder: "rgba(201,169,110,0.35)", // amber hairline (left edge)
  pokoText: "#1A2F1E",                         // dark ink
  pokoShadow: "0 2px 8px rgba(26,47,30,0.06)",

  // User — soft green tint over dark Poko surface
  userBg: "rgba(47,111,78,0.18)",
  userBorder: "1px solid rgba(47,111,78,0.28)",
  userText: "#F0EDEA",

  // Typing dots (live on the Poko bubble surface, so use Poko ink)
  typingDot: "rgba(26,47,30,0.55)",
} as const;

/* ---------- Geometry tokens ---------- */
export const POKO_RADII = {
  // "Speaking" corner is squared (4px), other three are 16px.
  pokoBubble: "16px 16px 16px 4px",      // bottom-left squared
  pokoBubbleBriefing: "4px 16px 16px 4px",
  userBubble: "16px 16px 4px 16px",      // bottom-right squared
} as const;

export const POKO_PADDING = {
  pokoBubble: "14px 18px",
  pokoBubbleBriefing: "18px 20px",
  userBubble: "12px 16px",
  typingBubble: "14px 18px",
} as const;

/* ---------- Typing indicator ---------- */
export const POKO_TYPING = {
  dotSize: 6,
  dotGap: 5,
  cycleMs: 900,    // 3 dots × 300ms stagger window
  staggerMs: 300,  // delay between consecutive dots
} as const;

/* ---------- Composed style objects ---------- */
export const pokoBubbleStyle = (variant: "default" | "briefing" = "default"): CSSProperties => ({
  background: variant === "briefing" ? POKO_COLORS.pokoBgBriefing : POKO_COLORS.pokoBg,
  border: "none",
  borderLeft: `2px solid ${POKO_COLORS.pokoAccentBorder}`,
  borderRadius: variant === "briefing" ? POKO_RADII.pokoBubbleBriefing : POKO_RADII.pokoBubble,
  padding: variant === "briefing" ? POKO_PADDING.pokoBubbleBriefing : POKO_PADDING.pokoBubble,
  color: POKO_COLORS.pokoText,
  boxShadow: POKO_COLORS.pokoShadow,
  lineHeight: 1.6,
});

export const userBubbleStyle: CSSProperties = {
  background: POKO_COLORS.userBg,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: POKO_COLORS.userBorder,
  borderRadius: POKO_RADII.userBubble,
  padding: POKO_PADDING.userBubble,
  color: POKO_COLORS.userText,
  boxShadow: "none",
  lineHeight: 1.6,
};

export const typingBubbleStyle: CSSProperties = {
  background: POKO_COLORS.pokoBg,
  border: "none",
  borderLeft: `2px solid ${POKO_COLORS.pokoAccentBorder}`,
  borderRadius: POKO_RADII.pokoBubble,
  padding: POKO_PADDING.typingBubble,
  display: "flex",
  alignItems: "center",
  gap: POKO_TYPING.dotGap,
  boxShadow: POKO_COLORS.pokoShadow,
};

export const typingDotStyle = (index: 0 | 1 | 2): CSSProperties => ({
  width: POKO_TYPING.dotSize,
  height: POKO_TYPING.dotSize,
  borderRadius: "50%",
  background: POKO_COLORS.typingDot,
  display: "inline-block",
  animation: `poko-typing-wave ${POKO_TYPING.cycleMs}ms ease-in-out infinite`,
  animationDelay: `${index * POKO_TYPING.staggerMs}ms`,
});
