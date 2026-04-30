import React, { useRef } from "react";
import { motion } from "framer-motion";

const MOCHI_IDLE = "/mochi-neutral.png";
const MOCHI_SCANNING = "/mochi-compass.png";
const MOCHI_CELEBRATING = "/mochi-celebrate.png";

export type MochiPose = "idle" | "scanning" | "celebrating";

const MOCHI_ENTRANCE_KEY = "mochi_hero_entrance_done";
const HERO_SIZE = 80;

/**
 * Mochi hero illustration — standardized wrapper.
 *
 * Every pose renders inside a fixed 180×180 box with object-fit: contain so
 * intrinsic PNG canvas dimensions never affect perceived size or position.
 * A single UI-generated ground shadow is drawn identically for all poses.
 */
const MochiHeroImage = ({ pose, size = HERO_SIZE }: { pose: MochiPose; size?: number }) => {
  const src = pose === "scanning" ? MOCHI_SCANNING : pose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_IDLE;
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasPlayedEntrance = useRef(sessionStorage.getItem(MOCHI_ENTRANCE_KEY) === "1");

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: "contain",
    objectPosition: "center bottom",
  };

  const groundShadow = (
    <div
      className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-foreground/[0.06] blur-[6px]"
      style={{ bottom: 2, width: size * 0.5, height: 6 }}
      aria-hidden="true"
    />
  );

  if (prefersReducedMotion) {
    return (
      <div className="relative inline-flex items-end justify-center" style={{ width: size, height: size }}>
        <img src={src} alt="Poko" className="drop-shadow-md" style={imgStyle} loading="lazy" />
        {groundShadow}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-end justify-center" style={{ width: size, height: size }}>
      <motion.img
        src={src}
        alt="Poko"
        className="drop-shadow-md"
        style={imgStyle}
        initial={hasPlayedEntrance.current ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={hasPlayedEntrance.current ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => {
          if (!hasPlayedEntrance.current) {
            sessionStorage.setItem(MOCHI_ENTRANCE_KEY, "1");
            hasPlayedEntrance.current = true;
          }
        }}
      />
      {groundShadow}
    </div>
  );
};

export default MochiHeroImage;
