import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  /** Editorial caption — shown below the image */
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Bounding rect of the source thumbnail at open-time, for FLIP-style zoom */
  originRect?: DOMRect | null;
  objectPosition?: string;
};

/**
 * HeroLightbox — cinematic in-page image viewer.
 * - Scales the image from its source rect into a fitted viewport view
 * - Backdrop, ESC, and swipe-down to dismiss
 * - Body-scroll lock while open
 * - Honors prefers-reduced-motion (instant fade, no scale)
 */
export default function HeroLightbox({
  open, onClose, src, alt, title, subtitle, eyebrow, originRect, objectPosition,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [reduced, setReduced] = useState(false);

  // Detect reduced-motion preference once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  // ESC to close + scroll lock + autofocus close button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Defer focus to avoid stealing during open animation start
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  // Compute initial transform from the source rect → viewport-fitted target.
  // We don't know the final rect ahead of time; Framer's `layout` would over-engineer
  // this. Instead we use a simple cinematic scale-in with the source center as origin.
  const initial =
    reduced || !originRect
      ? { opacity: 0 }
      : {
          opacity: 0,
          scale: 0.92,
          transformOrigin: `${originRect.left + originRect.width / 2}px ${
            originRect.top + originRect.height / 2
          }px`,
        };
  const animate = reduced ? { opacity: 1 } : { opacity: 1, scale: 1 };
  const exit = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as any } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — image viewer`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "var(--ranger-lightbox-bg)",
            display: "flex", flexDirection: "column",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
          onClick={onClose}
        >
          {/* Close button — always reachable in the safe-area-aware corner */}
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close image viewer"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0px) + 14px)",
              right: 14,
              width: 44, height: 44,
              borderRadius: 999,
              background: "var(--ranger-lightbox-chip)",
              border: "1px solid var(--ranger-parchment-faint)",
              color: "var(--ranger-paper-cream)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 2,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <X size={20} strokeWidth={1.6} />
          </button>

          {/* Image stage — drag-to-dismiss vertically */}
          <motion.div
            initial={initial}
            animate={animate}
            exit={exit}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.28}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 600) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minHeight: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "calc(env(safe-area-inset-top, 0px) + 64px) 16px 8px",
              touchAction: "pan-y",
            }}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                objectPosition: objectPosition ?? "center",
                borderRadius: 8,
                boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
                userSelect: "none",
                WebkitUserDrag: "none",
              } as any}
            />
          </motion.div>

          {/* Caption strip — editorial: eyebrow + italic title + body */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : 0.16 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "16px 22px calc(env(safe-area-inset-bottom, 0px) + 22px)",
              borderTop: "1px solid var(--ranger-rule)",
              background: "linear-gradient(180deg, var(--ranger-lightbox-veil-0) 0%, var(--ranger-lightbox-veil) 100%)",
              textAlign: "center",
            }}
          >
            {eyebrow && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
                <span aria-hidden="true" style={{ width: 18, height: 1, background: "var(--ranger-gold)" }} />
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.22em", color: "var(--ranger-parchment-body)",
                  textTransform: "uppercase",
                }}>
                  {eyebrow}
                </span>
                <span aria-hidden="true" style={{ width: 18, height: 1, background: "var(--ranger-gold)" }} />
              </div>
            )}
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic", fontWeight: 400,
              fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.015em",
              color: "var(--ranger-paper-cream)", margin: 0,
            }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13, fontWeight: 400,
                color: "var(--ranger-paper-cream)",
                margin: "10px auto 0", maxWidth: 480, lineHeight: 1.5,
              }}>
                {subtitle}
              </p>
            )}
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
              letterSpacing: "0.18em", color: "var(--ranger-parchment-mute)",
              textTransform: "uppercase", margin: "14px 0 0",
            }}>
              Tap anywhere to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
