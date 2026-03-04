import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, MapPin, Crown, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  {
    icon: Zap,
    title: "Unlimited Watches",
    description: "Monitor every permit type at once — never miss a cancellation drop.",
    free: "1 watch",
    pro: "Unlimited",
  },
  {
    icon: Bell,
    title: "Instant SMS Alerts",
    description: "Get a text the second a permit opens — before anyone else.",
    free: "No SMS",
    pro: "Instant alerts",
  },
  {
    icon: MapPin,
    title: "Multi-Park Coverage",
    description: "Watch permits across Yosemite, Rainier, and every park we add.",
    free: "1 park",
    pro: "All parks",
  },
];

/* ── Confetti particle component ── */
const ConfettiParticle = ({ index }: { index: number }) => {
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--primary) / 0.6)",
    "hsl(var(--secondary) / 0.7)",
  ];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 0.4;
  const duration = 1.2 + Math.random() * 0.8;
  const rotation = Math.random() * 720 - 360;
  const size = 6 + Math.random() * 6;
  const isCircle = index % 3 === 0;

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, -80 - Math.random() * 60, 120 + Math.random() * 40],
        x: [0, (Math.random() - 0.5) * 120],
        rotate: rotation,
        scale: [0, 1.2, 0.6],
      }}
      transition={{ duration, delay, ease: "easeOut" }}
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        bottom: "50%",
        width: size,
        height: isCircle ? size : size * 0.4,
        borderRadius: isCircle ? "50%" : "1px",
        backgroundColor: color,
      }}
    />
  );
};

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  }, []);

  const handleWaitlist = async () => {
    if (!user?.email || !user?.id) return;
    setJoining(true);

    const { error } = await supabase
      .from("pro_waitlist")
      .upsert(
        { user_id: user.id, email: user.email },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Waitlist insert error:", error.message);
      setJoining(false);
      toast({
        title: "🐻 Trail hiccup",
        description: "I'm having trouble reaching the park gates. Give me a moment!",
      });
      return;
    }

    supabase.functions.invoke("send-welcome-email", {
      body: { email: user.email },
    }).catch((e) => console.error("Welcome email trigger failed:", e));

    await new Promise((r) => setTimeout(r, 600));
    setJoining(false);
    setJoined(true);
    setShowConfetti(true);
    triggerHaptic();
  };

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const handleClose = (val: boolean) => {
    if (!val) {
      setJoined(false);
      setShowConfetti(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl max-h-[92vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {joined ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="relative px-8 py-16 text-center overflow-hidden"
            >
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <ConfettiParticle key={i} index={i} />
                  ))}
                </div>
              )}

              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                className="relative z-10"
              >
                <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6 shadow-lg ring-4 ring-secondary/10">
                  <motion.span
                    className="text-4xl"
                    animate={{ rotate: [0, 14, -14, 10, -6, 0] }}
                    transition={{ delay: 0.4, duration: 0.8, ease: "easeInOut" }}
                  >
                    🐻
                  </motion.span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10"
              >
                <h2 className="text-xl font-heading font-bold text-foreground">
                  You're in! Mochi 🐻 is tracking your spot.
                </h2>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
                  We'll alert you the moment WildAtlas Pro launches.
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => handleClose(false)}
                className="relative z-10 mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
              >
                Back to WildAtlas
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero header */}
              <div className="relative bg-primary px-6 pt-8 pb-10 text-center overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/5" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-primary-foreground/5" />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="relative z-10"
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Crown size={26} className="text-secondary-foreground" />
                  </div>
                  <h2 className="text-xl font-heading font-bold text-primary-foreground">WildAtlas Pro</h2>
                  <p className="text-sm text-primary-foreground/75 mt-1 font-medium">Unlimited watches · All parks</p>
                </motion.div>
              </div>

              {/* Features */}
              <div className="px-6 py-5 space-y-3">
                {features.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    className="flex items-start gap-3.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/8 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon size={17} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[13px] font-semibold text-foreground">{f.title}</h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{f.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider line-through decoration-muted-foreground/40">Free: {f.free}</span>
                        <span className="text-[9px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Pro: {f.pro}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pricing */}
              <div className="px-6 pb-4">
                <div className="bg-muted/60 rounded-xl p-4 text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-heading font-bold text-foreground">$9.99</span>
                    <span className="text-xs text-muted-foreground font-medium">/month</span>
                  </div>
                </div>
              </div>

              {/* Waitlist CTA */}
              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={handleWaitlist}
                  disabled={joining}
                  className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                >
                  {joining ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Joining…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Join the Waitlist
                    </>
                  )}
                </button>
                <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
                  WildAtlas Pro is coming soon. Join the waitlist to get early access and launch pricing!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default ProModal;
