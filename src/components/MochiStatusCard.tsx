import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MochiStatusCardProps {
  /** e.g. "Watching Half Dome in Yosemite" */
  title: string;
  /** e.g. "122 scans" */
  scanCount: string | null;
  /** e.g. "No openings yet" */
  statusNote: string;
  /** e.g. "Best odds: early morning" */
  insightLine: string | null;
}

/**
 * Living status card shown in the Mochi briefing state.
 * Renders a warm-neutral surface with structured typography,
 * an insight callout pill, and subtle micro-interactions.
 */
const MochiStatusCard = ({
  title,
  scanCount,
  statusNote,
  insightLine,
}: MochiStatusCardProps) => {
  // Track scan count changes to trigger fade-slide animation
  const [animatedScanCount, setAnimatedScanCount] = useState(scanCount);
  const [scanKey, setScanKey] = useState(0);
  const prevScanRef = useRef(scanCount);

  useEffect(() => {
    if (scanCount !== prevScanRef.current) {
      prevScanRef.current = scanCount;
      setScanKey((k) => k + 1);
      setAnimatedScanCount(scanCount);
    }
  }, [scanCount]);

  return (
    <div
      style={{
        background: "#F0EEEA",
        border: "1px solid rgba(0, 0, 0, 0.04)",
        borderRadius: 16,
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.04)",
        padding: "22px 20px 26px 20px",
        width: "100%",
        maxWidth: 340,
        textAlign: "left",
      }}
    >
      {/* Title */}
      <p
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1A1A1A",
          lineHeight: 1.3,
          maxWidth: "85%",
          margin: 0,
        }}
      >
        {title}
      </p>

      {/* Status line — scan count + status note */}
      <div
        style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0,
        }}
      >
        {scanCount && (
          <AnimatePresence mode="wait">
            <motion.span
              key={scanKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#444444",
              }}
            >
              {animatedScanCount}
            </motion.span>
          </AnimatePresence>
        )}
        {scanCount && (
          <span
            style={{
              fontSize: 14,
              color: "#9CA3AF",
              margin: "0 8px",
            }}
            aria-hidden="true"
          >
            ·
          </span>
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "#6B6B6B",
          }}
        >
          {statusNote}
        </span>
      </div>

      {/* Insight callout pill */}
      {insightLine && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: [1, 0.85, 1], scale: 1 }}
            transition={{
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.35 },
              scale: { duration: 0.3, ease: "easeOut" },
            }}
            style={{
              background: "rgba(47, 111, 78, 0.08)",
              borderRadius: 8,
              padding: "6px 12px",
              width: "fit-content",
            }}
          >
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#2F6F4E",
                letterSpacing: "0.2px",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {insightLine}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MochiStatusCard;
