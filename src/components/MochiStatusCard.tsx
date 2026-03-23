import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MochiStatusCardProps {
  title: string;
  scanCount: string | null;
  statusNote: string;
  insightLine: string | null;
  lastCheckAgo?: string | null;
}

const MochiStatusCard = ({
  title,
  scanCount,
  statusNote,
  insightLine,
  lastCheckAgo,
}: MochiStatusCardProps) => {
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
      className="bg-neutral-warm border border-border/20 rounded-2xl w-full max-w-[340px] text-left relative"
      style={{
        boxShadow: "0 4px 20px rgba(47, 111, 78, 0.05)",
        padding: "28px 20px 20px 20px",
      }}
    >
      {/* Last check — top right */}
      {lastCheckAgo && (
        <div style={{ position: 'absolute', top: 20, right: 20, textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', lineHeight: 1.2, margin: 0 }}>
            Last check
          </p>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3, margin: 0, marginTop: 2 }}>
            {lastCheckAgo}
          </p>
        </div>
      )}

      {/* Title */}
      <p className="font-heading text-[16px] font-semibold text-foreground leading-[1.3] max-w-[70%] text-balance">
        {title}
      </p>

      {/* Status line */}
      <div className="mt-2.5 flex items-end gap-3">
        {scanCount && (
          <div className="flex items-baseline gap-1.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={scanKey}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ fontSize: 23, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}
              >
                {animatedScanCount?.replace(/\s*scans?$/i, '')}
              </motion.span>
            </AnimatePresence>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: '#2F6F4E', lineHeight: 1 }}>
              SCANS
            </span>
          </div>
        )}
        <span className="text-[13px] font-normal text-muted-foreground" style={{ lineHeight: 1, paddingBottom: 1 }}>
          {statusNote}
        </span>
      </div>

      {/* Insight callout pill */}
      {insightLine && (
        <div className="mt-3.5 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: [1, 0.85, 1], scale: 1 }}
            transition={{
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.35 },
              scale: { duration: 0.3, ease: "easeOut" },
            }}
            className="bg-primary/8 border border-primary/10 rounded-lg px-3 py-1.5 w-fit"
          >
            <p className="text-[15px] font-semibold text-primary tracking-[0.2px] leading-[1.4]">
              {insightLine}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MochiStatusCard;
