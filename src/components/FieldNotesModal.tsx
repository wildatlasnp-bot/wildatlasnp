import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────────
   FIELD NOTES — HIDDEN MANIFESTO
   Triggered by triple-tapping the WildAtlas wordmark in the
   Discover masthead. No CTA, no metrics, no analytics — just a
   human voice behind the app. The right people will find it.
   ───────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
}

const CG = "'Cormorant Garamond', serif";
const DM = "'DM Sans', sans-serif";
const FOREST = "#1A2F1E";
const AMBER = "#C9A96E";

export default function FieldNotesModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Detect reduced-motion preference once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduceMotion(
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  }, []);

  // Mount → next frame, flip `visible` to drive the slide-up transition.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), reduceMotion ? 0 : 300);
      return () => clearTimeout(t);
    }
  }, [open, mounted, reduceMotion]);

  // Dim the app behind the modal to 20% opacity (per spec). Apply to #root
  // so the modal portal (mounted on document.body) stays at full opacity.
  useEffect(() => {
    if (!mounted) return;
    const root = document.getElementById("root");
    if (!root) return;
    const prevTransition = root.style.transition;
    const prevOpacity = root.style.opacity;
    root.style.transition = reduceMotion
      ? "none"
      : `opacity ${visible ? 500 : 200}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    root.style.opacity = visible ? "0.2" : "1";
    return () => {
      root.style.transition = prevTransition;
      root.style.opacity = prevOpacity;
    };
  }, [mounted, visible, reduceMotion]);

  if (!mounted) return null;

  const transitionMs = reduceMotion ? 0 : visible ? 500 : 300;
  const ease = visible
    ? "cubic-bezier(0.22, 1.2, 0.36, 1)" // spring-ish ease-out for entrance
    : "cubic-bezier(0.4, 0, 0.2, 1)";    // standard for exit

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Field Notes"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: FOREST,
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: reduceMotion ? 1 : visible ? 1 : 0,
        transition: reduceMotion
          ? "none"
          : `transform ${transitionMs}ms ${ease}, opacity ${transitionMs}ms ${ease}`,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "80px 40px",
          maxWidth: 640,
          margin: "0 auto",
          cursor: "default",
        }}
      >
        {/* Top amber rule */}
        <div style={{ width: 32, height: 1, background: AMBER }} />

        <div style={{ height: 20 }} />

        <p
          style={{
            fontFamily: DM,
            fontSize: 9,
            letterSpacing: "0.25em",
            color: AMBER,
            textTransform: "uppercase",
            margin: 0,
            fontWeight: 500,
          }}
        >
          Field Notes · WildAtlas
        </p>

        <div style={{ height: 32 }} />

        <h1
          style={{
            fontFamily: CG,
            fontSize: 48,
            fontWeight: 300,
            color: "#FFFFFF",
            lineHeight: 1.0,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Why permits matter.
        </h1>

        <div style={{ height: 40 }} />

        <div
          style={{
            fontFamily: CG,
            fontSize: 20,
            fontWeight: 300,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: "0 0 1.2em" }}>
            A permit to Half Dome is not a piece of paper. It is permission to stand
            somewhere that most people will never stand. To see something that cannot
            be unseen. To earn, briefly, a view that belongs to no one.
          </p>
          <p style={{ margin: "0 0 1.2em" }}>
            Recreation.gov releases cancellations without warning. A spot opens.
            Closes. Opens again. The window is measured in seconds, sometimes less.
            Most people miss it. Not because they don't want it — because they
            weren't watching.
          </p>
          <p style={{ margin: "0 0 1.2em" }}>WildAtlas watches.</p>
          <p style={{ margin: "0 0 1.2em" }}>
            We built this because we missed permits ourselves. Because we refreshed
            pages manually at odd hours and felt the particular frustration of being
            one minute too late. Because the parks are worth fighting for, and the
            fight shouldn't be with a website.
          </p>
          <p style={{ margin: "0 0 1.2em" }}>
            Poko doesn't sleep. Doesn't get distracted. Doesn't miss the window.
          </p>
          <p style={{ margin: 0 }}>
            You just have to be ready to move when we call.
          </p>
        </div>

        <div style={{ height: 48 }} />

        <p
          style={{
            fontFamily: CG,
            fontStyle: "italic",
            fontSize: 16,
            color: "rgba(255,255,255,0.4)",
            margin: 0,
            fontWeight: 300,
          }}
        >
          — WildAtlas, Los Angeles, 2026
        </p>

        <div style={{ height: 24 }} />

        {/* Bottom amber rule */}
        <div style={{ width: 32, height: 1, background: AMBER }} />
      </div>
    </div>,
    document.body
  );
}
