/**
 * MochiMessageList — renders the chat history for both Poko visual modes.
 *
 *   tone="briefing"     → dark stage, cream bubbles, AssistantBubbleShell
 *                         (capture button), Dispatch/today divider on the
 *                         very first assistant message, per-bubble entrance
 *                         stagger via burstStartRef.
 *   tone="conversation" → cream stage, sand bubbles, simpler motion.div,
 *                         no capture button, no dispatch divider.
 *
 * Owns no state. The burst stagger ref is passed in so MochiChat can keep
 * sole ownership of "which bubbles are new this render."
 */
import React from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

import MochiTrailCard, { parseTrailBlocks } from "@/components/MochiTrailCard";
import PokoMapCard, { parseMapBlocks } from "@/components/poko/PokoMapCard";
import AssistantBubbleShell from "@/components/poko/AssistantBubbleShell";
import RateLimitUpgradeCard from "@/components/mochi/RateLimitUpgradeCard";
import InlineDisclaimer from "@/components/mochi/InlineDisclaimer";
import {
  stripMarkdownTables,
  formatInlineBullets,
  MARKDOWN_NO_TABLES,
} from "@/components/mochi/mochi-formatting";
import {
  PERSONALITY_MARKER,
  getSeasonalSubtitle,
} from "@/components/mochi/mochi-greeting";
import { pokoBubbleStyle, userBubbleStyle } from "@/components/poko/bubbleTokens";
import { haptics } from "@/lib/haptics";

export interface MochiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  isSystem?: boolean;
  isRateLimitCard?: boolean;
  hasDisclaimer?: boolean;
}

interface MochiMessageListProps {
  tone: "briefing" | "conversation";
  messages: MochiMessage[];

  /** Stagger window — for briefing tone only. Indices ≥ this value get
      the bubble-in animation with a capped 80ms-per-bubble delay. */
  burstStart: number;

  /** Park id for AssistantBubbleShell capture (briefing only). */
  selectedParkId: string | null;

  /** Whether this is the user's very first session — controls whether
      the seasonal subtitle appears under the initial briefing bubble. */
  firstSession: boolean;

  /** Open the Pro paywall when a rate-limit card's CTA is tapped. */
  onUpgradeClick: () => void;
}

const MochiMessageList: React.FC<MochiMessageListProps> = ({
  tone,
  messages,
  burstStart,
  selectedParkId,
  firstSession,
  onUpgradeClick,
}) => {
  if (tone === "briefing") {
    return (
      <>
        <style>{`.mochi-prose ⚠, .mochi-prose [data-emoji="⚠️"] { filter: grayscale(1) brightness(1.3); }`}</style>
        {messages.map((msg, idx) => {
          if (msg.isSystem) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: "flex", justifyContent: "center", margin: "8px auto", maxWidth: 260 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(240,237,234,0.4)", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: "rgba(240,237,234,0.5)", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                </div>
              </motion.div>
            );
          }

          const isInitialBriefing =
            msg.role === "assistant" && idx === 0 && !messages.some((m) => m.role === "user");
          const isNew = idx >= burstStart && msg.id > 2;
          const burstOffset = Math.max(0, idx - burstStart);
          const staggerMs = isNew ? Math.min(burstOffset * 80, 640) : 0;

          return (
            <div
              key={msg.id}
              className={
                isNew
                  ? msg.role === "assistant"
                    ? "poko-bubble-in-left"
                    : "poko-bubble-in-right"
                  : undefined
              }
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "assistant" ? "flex-start" : "flex-end",
                width: isInitialBriefing ? "100%" : "auto",
                minWidth: 0,
                contain: "layout paint",
                ...(isNew
                  ? {
                      animationDelay: `${staggerMs}ms`,
                      willChange: "opacity, transform",
                      opacity: 0,
                    }
                  : null),
              }}
            >
              {msg.isRateLimitCard ? (
                <RateLimitUpgradeCard
                  onUpgrade={() => {
                    haptics.medium();
                    onUpgradeClick();
                  }}
                />
              ) : (
                <>
                  {isInitialBriefing && (
                    <div
                      style={{
                        alignSelf: "stretch",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                        margin: "2px 2px 14px",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.26em",
                        textTransform: "uppercase",
                        color: "rgba(240,237,234,0.62)",
                        lineHeight: 1,
                        maxWidth: "100%",
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>Dispatch</span>
                      <span
                        style={{
                          flex: 1,
                          height: 1,
                          transform: "translateY(-2px)",
                          background:
                            "linear-gradient(to right, rgba(240,237,234,0.28) 0%, rgba(240,237,234,0.10) 55%, transparent 100%)",
                        }}
                      />
                      <span
                        style={{
                          flexShrink: 0,
                          color: "rgba(201,169,110,0.85)",
                          fontStyle: "italic",
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 12,
                          fontWeight: 400,
                          letterSpacing: "0.04em",
                          textTransform: "none",
                          transform: "translateY(1px)",
                        }}
                      >
                        today
                      </span>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <AssistantBubbleShell
                      className="mochi-prose-container"
                      parkId={selectedParkId ?? null}
                      captureText={
                        msg.content.startsWith(PERSONALITY_MARKER)
                          ? msg.content.slice(PERSONALITY_MARKER.length)
                          : msg.content
                      }
                      enableCapture={!isInitialBriefing && !msg.isSystem}
                      bubbleStyle={{
                        maxWidth: isInitialBriefing ? "100%" : "85%",
                        width: isInitialBriefing ? "100%" : "auto",
                        alignSelf: "flex-start",
                        marginRight: "auto",
                        marginLeft: 0,
                        fontSize: isInitialBriefing ? 16 : 15,
                        fontWeight: 400,
                        fontFamily: isInitialBriefing
                          ? "'Cormorant Garamond', serif"
                          : "'DM Sans', sans-serif",
                        fontStyle: isInitialBriefing ? "italic" : "normal",
                        ...pokoBubbleStyle(isInitialBriefing ? "briefing" : "default"),
                        lineHeight: isInitialBriefing ? 1.55 : 1.6,
                      }}
                    >
                      {(() => {
                        const isPersonality =
                          isInitialBriefing && msg.content.startsWith(PERSONALITY_MARKER);
                        const cleaned = isPersonality
                          ? msg.content.slice(PERSONALITY_MARKER.length)
                          : msg.content;
                        return (
                          <div
                            key={isInitialBriefing ? `briefing-${cleaned}` : undefined}
                            className={`mochi-prose ${isInitialBriefing ? "poko-dispatch-fade" : ""}`}
                          >
                            {parseTrailBlocks(cleaned).map((block, bi) =>
                              block.type === "trails" ? (
                                <div key={bi} className="space-y-2 -mx-1">
                                  {block.value.map((trail, ti) => (
                                    <MochiTrailCard key={ti} trail={trail} />
                                  ))}
                                </div>
                              ) : (
                                <div key={bi}>
                                  {parseMapBlocks(block.value).map((sub, si) =>
                                    sub.type === "map" ? (
                                      <div key={si} style={{ margin: "10px 0" }}>
                                        <PokoMapCard map={sub.value} />
                                      </div>
                                    ) : (
                                      <ReactMarkdown key={si} components={MARKDOWN_NO_TABLES}>
                                        {formatInlineBullets(stripMarkdownTables(sub.value))}
                                      </ReactMarkdown>
                                    ),
                                  )}
                                </div>
                              ),
                            )}
                            {isInitialBriefing && !isPersonality && !firstSession && (
                              <p
                                style={{
                                  marginTop: 8,
                                  marginBottom: 0,
                                  fontFamily: "'DM Sans', sans-serif",
                                  fontSize: 12,
                                  fontStyle: "italic",
                                  color: "#8A9E8A",
                                  lineHeight: 1.5,
                                }}
                              >
                                {getSeasonalSubtitle()}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </AssistantBubbleShell>
                  ) : (
                    <div
                      className="mochi-prose-container"
                      style={{
                        width: "fit-content",
                        maxWidth: "72%",
                        alignSelf: "flex-end",
                        marginLeft: "auto",
                        marginRight: 0,
                        fontSize: 15,
                        fontWeight: 400,
                        fontFamily: "'DM Sans', sans-serif",
                        ...userBubbleStyle,
                      }}
                    >
                      {msg.content}
                    </div>
                  )}
                  {msg.role === "assistant" && msg.hasDisclaimer && <InlineDisclaimer />}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  }

  // tone === "conversation"
  return (
    <>
      {messages.map((msg, idx) => {
        if (msg.isSystem) {
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: "flex", justifyContent: "center", margin: "8px auto", maxWidth: 260 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--wa-ink-muted)", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: "var(--wa-ink-muted)", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
              </div>
            </motion.div>
          );
        }

        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role || prevMsg.isSystem;
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
        const isLastInGroup = !nextMsg || nextMsg.role !== msg.role || nextMsg.isSystem;

        const isDense =
          msg.role === "assistant" &&
          (/^#{2,3}\s/m.test(msg.content) ||
            (msg.content.match(/^[-*•]\s/gm) || []).length >= 3);

        const marginTop = idx === 0 ? 0 : isFirstInGroup ? 8 : 2;

        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.4, 1] }}
            className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"}`}
            style={{ marginTop, marginBottom: isLastInGroup ? 0 : 0 }}
          >
            {msg.isRateLimitCard ? (
              <RateLimitUpgradeCard
                onUpgrade={() => {
                  haptics.medium();
                  onUpgradeClick();
                }}
              />
            ) : (
              <>
                <div
                  style={
                    msg.role === "assistant"
                      ? {
                          maxWidth: "84%",
                          background: "rgba(244, 238, 228, 0.94)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          border: "0.5px solid rgba(195, 178, 152, 0.45)",
                          borderLeft: isDense
                            ? "2px solid var(--wa-green-light)"
                            : "0.5px solid rgba(195, 178, 152, 0.45)",
                          borderRadius: isFirstInGroup ? "12px 18px 18px 18px" : "18px 18px 18px 18px",
                          padding: "11px 15px",
                          fontSize: 13,
                          fontWeight: 300,
                          fontFamily: "'DM Sans', sans-serif",
                          color: "rgba(28,24,18,.8)",
                          lineHeight: 1.6,
                        }
                      : {
                          maxWidth: "84%",
                          background: "rgba(47, 111, 78, 0.85)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          color: "var(--wa-cream)",
                          borderRadius: "18px 10px 18px 18px",
                          padding: "11px 15px",
                          fontSize: 13,
                          fontWeight: 300,
                          fontFamily: "'DM Sans', sans-serif",
                          lineHeight: 1.6,
                        }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className="mochi-prose">
                      {parseTrailBlocks(msg.content).map((block, bi) =>
                        block.type === "trails" ? (
                          <div key={bi} className="space-y-2 -mx-1">
                            {block.value.map((trail, ti) => (
                              <MochiTrailCard key={ti} trail={trail} />
                            ))}
                          </div>
                        ) : (
                          <div key={bi}>
                            {parseMapBlocks(block.value).map((sub, si) =>
                              sub.type === "map" ? (
                                <div key={si} style={{ margin: "10px 0" }}>
                                  <PokoMapCard map={sub.value} />
                                </div>
                              ) : (
                                <ReactMarkdown key={si} components={MARKDOWN_NO_TABLES}>
                                  {formatInlineBullets(stripMarkdownTables(sub.value))}
                                </ReactMarkdown>
                              ),
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && msg.hasDisclaimer && <InlineDisclaimer />}
              </>
            )}
          </motion.div>
        );
      })}
    </>
  );
};

export default MochiMessageList;
