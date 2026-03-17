import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const WELCOMED_KEY = "wildatlas_welcomed";

interface WelcomeModalProps {
  loading: boolean;
  activeCount: number;
  onSetUpAlert: () => void;
}

export default function WelcomeModal({ loading, activeCount, onSetUpAlert }: WelcomeModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem(WELCOMED_KEY)) return;
    if (activeCount > 0) {
      localStorage.setItem(WELCOMED_KEY, "true");
      return;
    }
    setOpen(true);
  }, [loading, activeCount]);

  const dismiss = () => {
    setOpen(false);
    localStorage.setItem(WELCOMED_KEY, "true");
  };

  const handleCTA = () => {
    dismiss();
    onSetUpAlert();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

          {/* Card */}
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-card border border-border/40 shadow-2xl p-6 flex flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Mochi illustration */}
            <img
              src="/mochi-celebrate.png"
              alt="Mochi celebrating"
              className="w-28 h-28 object-contain mb-4"
            />

            <h2 className="text-xl font-bold text-foreground mb-2">Welcome to WildAtlas</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Set up your first alert and WildAtlas will watch Recreation.gov for permit openings.
            </p>

            <Button
              onClick={handleCTA}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 text-[15px] font-semibold"
            >
              Set Up My First Alert
            </Button>

            <button
              onClick={dismiss}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I'll explore first
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
