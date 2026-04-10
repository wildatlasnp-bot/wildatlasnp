import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DM_SANS = "'DM Sans', sans-serif";

/**
 * A portal-mounted toast that slides up from the bottom,
 * positioned 20px above the bottom tab bar (~60px tall → bottom: 80px).
 * Auto-dismisses after 3 seconds.
 */
export function WatchActivatedToast({
  show,
  onDone,
}: {
  show: boolean;
  onDone: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      const timer = setTimeout(() => {
        setVisible(false);
        // Wait for exit animation before unmount
        setTimeout(() => {
          setMounted(false);
          onDone();
        }, 200);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setMounted(false);
    }
  }, [show, onDone]);

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes watchToastSlideUp {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes watchToastSlideDown {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, 12px); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translate(-50%, 0)",
          zIndex: 99999,
          fontFamily: DM_SANS,
          fontSize: 14,
          fontWeight: 500,
          color: "#F0EDEA",
          background: "#2F6F4E",
          borderRadius: 24,
          padding: "12px 24px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          pointerEvents: "none",
          animation: visible
            ? "watchToastSlideUp 200ms ease-out forwards"
            : "watchToastSlideDown 200ms ease-out forwards",
        }}
      >
        Watch activated
      </div>
    </>,
    document.body
  );
}
