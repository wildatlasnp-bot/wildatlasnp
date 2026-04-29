/**
 * SaveToLogButton — small "capture" affordance overlaid on Poko chat
 * bubbles. Tapping it persists the bubble's text to Saved Signals
 * and triggers a fly-to-dock animation that lands on the Discover
 * tab icon. Once saved, the button switches to a confirmed state.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { haptics } from "@/lib/haptics";
import {
  flyToDock,
  isSignalSaved,
  saveSignal,
  subscribeSavedSignals,
} from "@/lib/saved-signals";

interface SaveToLogButtonProps {
  /** The element that should "fly" to the dock — usually the bubble. */
  bubbleRef: React.RefObject<HTMLElement>;
  /** The text content to capture. */
  text: string;
  /** Active park context for grouping in Discover. */
  parkId: string | null;
}

export default function SaveToLogButton({ bubbleRef, text, parkId }: SaveToLogButtonProps) {
  const { user } = useAuth();
  const userKey = user?.id ?? "guest";
  const [saved, setSaved] = useState(false);
  const lockRef = useRef(false);

  // Reflect persisted state so the button is correct after remount
  useEffect(() => {
    if (!parkId || !text.trim()) return;
    setSaved(isSignalSaved(userKey, parkId, text));
    return subscribeSavedSignals(() => {
      setSaved(isSignalSaved(userKey, parkId, text));
    });
  }, [userKey, parkId, text]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (saved || lockRef.current || !parkId || !text.trim()) return;
      lockRef.current = true;
      haptics.medium();

      const sourceEl = bubbleRef.current;
      if (sourceEl) flyToDock(sourceEl);

      // Persist after the animation begins so the optimistic state
      // doesn't beat the visual transition.
      window.setTimeout(() => {
        saveSignal(userKey, { parkId, text });
        setSaved(true);
        lockRef.current = false;
      }, 60);
    },
    [bubbleRef, parkId, saved, text, userKey],
  );

  // Only show when there's actually something to save
  if (!parkId || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? "Saved to your log" : "Save this to your log"}
      aria-pressed={saved}
      className="poko-capture-btn"
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: saved ? "rgba(201,169,110,0.22)" : "rgba(11,43,27,0.55)",
        border: `1px solid ${saved ? "rgba(201,169,110,0.7)" : "rgba(240,237,234,0.18)"}`,
        color: saved ? "#C9A96E" : "rgba(240,237,234,0.85)",
        opacity: saved ? 1 : 0.78,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        cursor: saved ? "default" : "pointer",
        transition:
          "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        WebkitTapHighlightColor: "transparent",
        zIndex: 3,
      }}
    >
      {saved ? (
        <Check size={14} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Bookmark size={14} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
