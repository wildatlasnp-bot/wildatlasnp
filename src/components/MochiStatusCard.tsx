import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MochiStatusCardProps {
  title: string;
  scanCount: string | null;
  statusNote: string;
  insightLine: string | null;
}

const MochiStatusCard = ({
  title,
  scanCount,
  statusNote,
  insightLine,
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
      className="bg-neutral-warm border border-border/20 rounded-2xl w-full max-w-[340px] text-left"
      style={{
        boxShadow: "0 4px 20px rgba(47, 111, 78, 0.05)",
        padding: "28px 20px 20px 20px",
      }}
    >
      {/* Title */}
      <p className="text-[18px] font-semibold text-foreground leading-[1.3] max-w-[85%]">
        {title}
      </p>

      {/* Status line */}
      <div className="mt-1.5 flex items-center flex-wrap">
        {scanCount && (
          <AnimatePresence mode="wait">
            <motion.span
              key={scanKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[14px] font-medium text-text-body"
            >
              {animatedScanCount}
            </motion.span>
          </AnimatePresence>
        )}
        {scanCount && (
          <span className="text-[14px] text-text-subtle mx-2" aria-hidden="true">·</span>
        )}
        <span className="text-[14px] font-normal text-muted-foreground">
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
