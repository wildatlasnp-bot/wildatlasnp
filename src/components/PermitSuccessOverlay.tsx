import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Mountain, X, Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  "hsl(11, 68%, 62%)",
  "hsl(39, 33%, 86%)",
  "hsl(11, 68%, 72%)",
  "hsl(39, 40%, 78%)",
  "hsl(11, 50%, 50%)",
  "hsl(39, 33%, 92%)",
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

const PermitSuccessOverlay = ({
  open,
  onClose,
  permitName = "Half Dome",
  permitDate = "Aug 14, 2026",
}: Props) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [minutesLeft] = useState(17);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareText = `I just scored a ${permitName} permit with WildAtlas! 🏔️🎉`;
  const shareUrl = "https://wildatlas.app";

  useEffect(() => {
    if (open) {
      setParticles(generateParticles(50));
      setCopied(false);
    }
  }, [open]);

  const handleClaim = useCallback(() => {
    window.open("https://www.recreation.gov", "_blank", "noopener");
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "WildAtlas", text: shareText, url: shareUrl });
      } catch {}
    }
  }, [shareText]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    setCopied(true);
    toast({ title: "Copied!", description: "Share text copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }, [shareText, toast]);

  const handleTwitterShare = useCallback(() => {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,width=550,height=420");
  }, [shareText]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            onClick={onClose}
          />

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
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={16} />
            </button>

            <div className="px-6 pt-7 pb-6">
              {/* Icon + Header */}
              <div className="text-center mb-5">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.15, damping: 12 }}
                  className="w-16 h-16 rounded-full bg-status-found/15 flex items-center justify-center mx-auto mb-4"
                >
                  <Mountain size={28} className="text-secondary" />
                </motion.div>
                <h2 className="font-heading text-[22px] font-bold text-primary uppercase tracking-wide">
                  Adventure Unlocked
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {permitName} · {permitDate}
                </p>
              </div>

              {/* Mochi message */}
              <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm">🐻</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                      Mochi
                    </p>
                    <p className="text-[13px] text-foreground leading-relaxed">
                      Permit sniped. <strong className="text-secondary">{permitName}</strong> on{" "}
                      <strong className="text-secondary">{permitDate}</strong> — claim it now before it expires.
                    </p>
                  </div>
                </div>
              </div>

              {/* Critical countdown */}
              <div className="bg-secondary/10 border border-secondary/25 rounded-xl p-4 mb-5">
                <p className="text-[13px] font-semibold text-foreground text-center leading-relaxed">
                  You have{" "}
                  <span className="text-secondary font-bold text-base">
                    {minutesLeft} minutes
                  </span>{" "}
                  left to finalize this application on Recreation.gov.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={handleClaim}
                  className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold text-[14px] py-3.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={15} />
                  Snag It Now
                </button>
                <button
                  onClick={handleClaim}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[13px] py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Claim on Recreation.gov
                </button>
              </div>

              {/* Victory share */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-3">
                  Share your victory 🎉
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTwitterShare}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 border border-border rounded-xl py-2.5 text-[12px] font-semibold text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Post
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 border border-border rounded-xl py-2.5 text-[12px] font-semibold text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    {copied ? <Check size={13} className="text-secondary" /> : <Copy size={13} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      onClick={handleNativeShare}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-foreground/5 border border-border rounded-xl py-2.5 text-[12px] font-semibold text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermitSuccessOverlay;
