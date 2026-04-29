/**
 * AssistantBubbleShell — thin wrapper around the existing assistant
 * chat bubble that owns its own ref so the SaveToLogButton can fly
 * the bubble to the Discover dock without us threading refs through
 * every parent. Renders the existing styled bubble untouched plus
 * the capture button absolutely positioned in its top-right corner.
 */
import React, { useRef } from "react";
import SaveToLogButton from "./SaveToLogButton";

interface AssistantBubbleShellProps {
  /** Plain text used for capture; empty string disables the button. */
  captureText: string;
  /** Active park id (capture is disabled without one). */
  parkId: string | null;
  /** Visible bubble inline styles (themed surface + typography). */
  bubbleStyle: React.CSSProperties;
  /** Whether to expose the capture button at all. */
  enableCapture: boolean;
  className?: string;
  children: React.ReactNode;
}

const AssistantBubbleShell: React.FC<AssistantBubbleShellProps> = ({
  captureText,
  parkId,
  bubbleStyle,
  enableCapture,
  className,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      style={{ ...bubbleStyle, position: "relative" }}
    >
      {enableCapture && (
        <SaveToLogButton bubbleRef={ref} text={captureText} parkId={parkId} />
      )}
      {children}
    </div>
  );
};

export default AssistantBubbleShell;
