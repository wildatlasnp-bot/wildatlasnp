/**
 * MochiComposer — bottom input + send button + status row + footer copy.
 *
 * Used in BOTH chat tones:
 *   - tone="dark"  → briefing/masthead view (transparent over dark stage)
 *   - tone="light" → conversation view (cream surface with hairline border)
 *
 * Pure presentation. Owns no state — all input/send/disclaimer/quota logic
 * is passed in from MochiChat. The status-row block is supplied as a render
 * prop because its visual lives in MochiChat (scanner data + opacity hooks).
 */
import React from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface MochiComposerProps {
  tone: "dark" | "light";
  showDisclaimer?: boolean;

  // Input state
  input: string;
  setInput: (v: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  isLoading: boolean;

  // Status row (rendered by parent — owns scanner + opacity hooks)
  renderStatusRow: (args: { tone: "dark" | "light" }) => React.ReactNode;

  // Free-tier quota whisper
  isPro: boolean;
  questionsUsed: number;
  onUpgradeClick: () => void;
}

const MochiComposer: React.FC<MochiComposerProps> = ({
  tone,
  showDisclaimer = false,
  input,
  setInput,
  onInputKeyDown,
  onSend,
  isLoading,
  renderStatusRow,
  isPro,
  questionsUsed,
  onUpgradeClick,
}) => {
  const isDark = tone === "dark";

  // Single source of truth for screen-edge inset. The briefing bubble
  // container uses `padding: '0 24px'`; mirrored here so any future
  // change cascades to the composer wrapper AND the disclaimer.
  const BRIEFING_CARD_INSET = 24;
  const wrapperPaddingX = isDark ? 16 : 20;
  const disclaimerPaddingX = Math.max(0, BRIEFING_CARD_INSET - wrapperPaddingX);

  const remaining = 5 - questionsUsed;
  const showQuotaWhisper = !isPro && remaining <= 3 && remaining >= 0;

  return (
    <div
      style={{
        flexShrink: 0,
        background: isDark ? "transparent" : "var(--wa-cream)",
        borderTop: isDark ? undefined : "1px solid var(--wa-rule)",
        paddingTop: isDark ? 8 : 10,
        paddingLeft: wrapperPaddingX,
        paddingRight: wrapperPaddingX,
        paddingBottom: isDark ? 8 : 8,
      }}
    >
      <div
        className={`flex items-center ${isDark ? "" : "mochi-light-composer"}`}
        style={
          isDark
            ? {
                borderRadius: 20,
                background: "hsl(145 22% 14%)",
                border: "1px solid hsl(0 0% 100% / 0.10)",
                borderTop: "1px solid hsl(0 0% 100% / 0.15)",
                padding: "10px 10px 10px 20px",
                boxShadow: "0 8px 32px hsl(0 0% 0% / 0.30)",
              }
            : {
                borderRadius: 28,
                background: "rgba(252,248,242,0.96)",
                border: "0.5px solid rgba(180,162,136,0.42)",
                padding: "8px 8px 8px 16px",
                position: "relative" as const,
              }
        }
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Ask about any park or permit..."
          aria-label="Ask Poko anything"
          className={isDark ? "mochi-dark-input" : "mochi-light-input"}
          style={
            isDark
              ? {
                  flex: 1,
                  background: "transparent",
                  fontSize: 15,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "hsl(39 33% 96%)",
                  outline: "none",
                  border: "none",
                  minWidth: 0,
                }
              : {
                  flex: 1,
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: 300,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "var(--wa-ink)",
                  outline: "none",
                  border: "none",
                  minWidth: 0,
                }
          }
          disabled={isLoading}
        />
        <style>{`
          .mochi-light-composer:focus-within {
            border-color: var(--wa-green) !important;
            transition: border-color 0.18s ease;
          }
          .mochi-light-composer input::placeholder {
            color: var(--wa-ink-placeholder);
          }
          .mochi-light-composer input:focus {
            outline: none;
            box-shadow: none;
          }
        `}</style>
        <style>{`
          .poko-send-gold { transition: background 220ms ease, border-color 220ms ease, transform 120ms ease, opacity 220ms ease; }
          .poko-send-gold:not(:disabled):hover { background: #C9A96E; border-color: #C9A96E; }
          .poko-send-gold:not(:disabled):active { transform: scale(0.94); }
        `}</style>
        <button
          type="button"
          onClick={onSend}
          disabled={isLoading || !input.trim()}
          aria-label={isLoading ? "Sending message" : "Send message"}
          aria-busy={isLoading}
          aria-disabled={isLoading || !input.trim()}
          className="poko-send-gold shrink-0 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            background: !input.trim() || isLoading
              ? (isDark ? "rgba(240,237,234,0.06)" : "rgba(201,169,110,0.18)")
              : "rgba(201,169,110,0.95)",
            border: `1px solid ${!input.trim() || isLoading
              ? (isDark ? "rgba(240,237,234,0.18)" : "rgba(201,169,110,0.35)")
              : "transparent"}`,
            color: !input.trim() || isLoading
              ? (isDark ? "rgba(240,237,234,0.45)" : "rgba(60,50,30,0.55)")
              : "#1A2F1E",
            cursor: !input.trim() || isLoading ? "default" : "pointer",
          }}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>

      {renderStatusRow({ tone: isDark ? "dark" : "light" })}

      {showDisclaimer && (
        <p
          style={{
            fontSize: 12,
            fontWeight: 400,
            fontFamily: "'DM Sans', sans-serif",
            color: isDark ? "rgba(240,237,234,0.62)" : "rgba(26,47,30,0.58)",
            textAlign: "center",
            paddingTop: 10,
            paddingBottom: 14,
            paddingLeft: disclaimerPaddingX,
            paddingRight: disclaimerPaddingX,
            lineHeight: 1.55,
            letterSpacing: "0.01em",
            margin: 0,
          }}
        >
          Poko can make mistakes. Always verify permits and trail conditions at nps.gov and recreation.gov.
        </p>
      )}

      {showQuotaWhisper && (
        <p
          style={{
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            textAlign: "center",
            margin: "2px 20px 8px",
            lineHeight: 1.4,
          }}
        >
          {remaining > 0 ? (
            <span style={{ color: "#C9A96E" }}>
              {remaining} question{remaining !== 1 ? "s" : ""} remaining today
            </span>
          ) : (
            <span
              style={{ color: "#2F6F4E", cursor: "pointer" }}
              onClick={() => {
                haptics.medium();
                onUpgradeClick();
              }}
              role="button"
              tabIndex={0}
            >
              Upgrade to Pro for unlimited questions
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export default MochiComposer;
