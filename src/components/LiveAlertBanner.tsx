import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LiveAlertBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 bg-alert px-4 py-2.5 text-alert-foreground text-sm font-medium shadow-lg"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle size={16} className="shrink-0 animate-pulse-soft" />
          <span className="truncate">
            ⚠ Tioga Road closed due to snow. Expect delays at Arch Rock entrance.
          </span>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default LiveAlertBanner;
