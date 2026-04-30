/**
 * MochiHeader — conversation-mode top bar.
 *
 * Shown at the top of the chat once the user has sent their first message
 * (i.e. when we've left the briefing/masthead view). Displays the Poko
 * avatar with a pose-based crossfade plus the static "Poko / your park
 * companion" wordmark. Pure presentation — owns no state.
 */
import React from "react";
import { motion } from "framer-motion";

const MOCHI_IDLE = "/mochi-neutral.png";
const MOCHI_SCANNING = "/mochi-compass.png";
const MOCHI_CELEBRATING = "/mochi-celebrate.png";

export type MochiPose = "idle" | "scanning" | "celebrating";

interface MochiHeaderProps {
  pose: MochiPose;
}

const MochiHeader: React.FC<MochiHeaderProps> = ({ pose }) => {
  const src =
    pose === "scanning" ? MOCHI_SCANNING
    : pose === "celebrating" ? MOCHI_CELEBRATING
    : MOCHI_IDLE;

  return (
    <div
      className="px-5 pt-4 pb-2 flex items-center gap-3"
      style={{ borderBottom: "1px solid var(--wa-rule)" }}
    >
      <div
        className="w-10 h-10 rounded-full border border-border/40 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--wa-cream)" }}
      >
        <motion.img
          key={pose}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          src={src}
          alt=""
          aria-hidden="true"
          className="w-8 h-8 object-contain object-center"
        />
      </div>
      <div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            color: "var(--wa-ink)",
            margin: 0,
          }}
        >
          Poko
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: 300,
            fontFamily: "'DM Sans', sans-serif",
            color: "var(--wa-ink-muted)",
            margin: 0,
          }}
        >
          your park companion
        </p>
      </div>
    </div>
  );
};

export default MochiHeader;
