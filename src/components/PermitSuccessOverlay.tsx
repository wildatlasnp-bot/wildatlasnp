import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  drift: number;
}

const CONFETTI_COLORS = [
  "hsl(11, 68%, 62%)",   // Earthy Orange (secondary)
  "hsl(39, 33%, 86%)",   // Sand
  "hsl(11, 68%, 72%)",   // Light orange
  "hsl(39, 40%, 78%)",   // Warm sand
  "hsl(113, 38%, 25%)",  // Forest Green accent
  "hsl(39, 33%, 92%)",   // Light cream
];

const generateParticles = (count: number): Particle[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    size: 4 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 1.5,
    rotation: Math.random() * 360,
    drift: -30 + Math.random() * 60,
  }));

interface Props {
  open: boolean;
  onClose: () => void;
  permitName?: string;
  permitDate?: string;
}

const PermitSuccessOverlay = ({ open, onClose, permitName = "Half Dome", permitDate = "Aug 12, 2026" }: Props) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (open) setParticles(generateParticles(40));
  }, [open]);

  const handleClaim = useCallback(() => {
    window.open("https://www.recreation.gov", "_blank", "noopener");
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: `${p.x}vw`, y: `${p.y}vh`, rotate: 0, opacity: 1 }}
                animate={{
                  y: "110vh",
                  x: `${p.x + p.drift}vw`,
                  rotate: p.rotation + 720,
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
                className="absolute rounded-sm"
                style={{
                  width: p.size,
                  height: p.size * 0.6,
                  backgroundColor: p.color,
                }}
              />
            ))}
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-secondary via-secondary/70 to-primary" />

            <div className="px-6 pt-6 pb-5">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div className="text-center mb-5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2, damping: 12 }}
                  className="w-14 h-14 rounded-full bg-secondary/15 text-secondary flex items-center justify-center mx-auto mb-4"
                >
                  <span className="text-2xl">🎯</span>
                </motion.div>
                <h2 className="font-heading text-2xl font-bold text-foreground">Adventure Unlocked</h2>
                <p className="text-sm text-muted-foreground mt-1">{permitName} · {permitDate}</p>
              </div>

              {/* Mochi message */}
              <div className="bg-muted/50 border border-border rounded-xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm">🐻</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">Mochi</p>
                    <p className="text-[13px] text-foreground leading-[1.6]">
                      We caught it! I've sniped your permit. You have <strong className="text-secondary">20 minutes</strong> to finalize this on Recreation.gov.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={handleClaim}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[14px] py-3.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={15} />
                  Claim on Recreation.gov
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-[13px] font-medium text-muted-foreground py-2.5 rounded-xl hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermitSuccessOverlay;
