import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { COACHED_KEY } from "@/lib/storageKeys";
import { useAuth } from "@/contexts/AuthContext";

interface CoachMarkProps {
  loading: boolean;
  activeCount: number;
}

export default function CoachMark({ loading, activeCount }: CoachMarkProps) {
  const { welcomed } = useAuth();
  const [visible, setVisible] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!welcomed) return;
    if (localStorage.getItem(COACHED_KEY)) return;
    if (activeCount > 0) {
      if (visible) {
        // Coach mark was visible during the 0→1 transition — user just added their first watcher
        setVisible(false);
        localStorage.setItem(COACHED_KEY, "true");
      }
      return;
    }
    setVisible(true);
  }, [loading, activeCount, visible]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(COACHED_KEY, "true");
  };

  return (
    <div className="absolute -top-1 -right-1 z-10">
      {/* Pulsing beacon */}
      <button
        onClick={() => setTooltipOpen((o) => !o)}
        className="relative flex items-center justify-center w-5 h-5"
        aria-label="Tip"
      >
        <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-secondary/40 animate-ping" style={{ animationDuration: "1.8s" }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary shadow-sm" />
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-6 right-0 w-56 rounded-xl bg-card border border-border/60 shadow-xl p-3 text-left"
          >
            <button
              onClick={dismiss}
              className="absolute top-2 right-2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss tip"
            >
              <X size={12} />
            </button>
            <p className="text-[12px] text-muted-foreground leading-relaxed pr-4">
              Tap here to watch a permit. We'll alert you when one opens.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
