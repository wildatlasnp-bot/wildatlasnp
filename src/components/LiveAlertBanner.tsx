import { X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LiveAlertBanner = () => {
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 bg-alert px-4 py-2 text-alert-foreground"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alert-foreground opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-alert-foreground" />
            </span>
            <span className="text-xs font-medium tracking-wide truncate">
              LIVE: Yosemite Valley parking is 95% FULL. Enter before 6 AM.
            </span>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
            aria-label="Dismiss alert"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveAlertBanner;
