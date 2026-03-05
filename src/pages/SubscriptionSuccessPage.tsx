import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";

const CONFETTI_COLORS = [
  "hsl(var(--secondary))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(11, 68%, 62%)",
  "hsl(39, 33%, 86%)",
  "hsl(11, 68%, 72%)",
];

const generateParticles = (count: number) =>
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

const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, refreshProStatus } = useProStatus();
  const [verifying, setVerifying] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    const verify = async () => {
      attempts++;
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.subscribed) {
          setConfirmed(true);
          setVerifying(false);
          refreshProStatus?.();
          return;
        }
      } catch {}

      if (attempts < maxAttempts) {
        setTimeout(verify, 2000);
      } else {
        setVerifying(false);
      }
    };

    verify();
  }, [user, navigate, refreshProStatus]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-sm w-full text-center"
      >
        {verifying ? (
          <>
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
              <Loader2 size={28} className="text-secondary animate-spin" />
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground mb-2">
              Confirming your subscription…
            </h1>
            <p className="text-sm text-muted-foreground">
              This usually takes just a few seconds.
            </p>
          </>
        ) : confirmed || isPro ? (
          <>
            {/* Confetti */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
              {generateParticles(60).map((p) => (
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
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-status-quiet/15 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle size={32} className="text-status-quiet" />
            </motion.div>
            <h1 className="font-heading font-bold text-2xl text-foreground mb-2">
              Welcome to Pro! 🎉
            </h1>
            <p className="text-sm text-muted-foreground mb-2">
              Your subscription is active. You now have access to:
            </p>
            <ul className="text-left text-sm text-foreground space-y-2 mb-8 mx-auto max-w-[240px]">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-status-quiet shrink-0" />
                Unlimited permit tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-status-quiet shrink-0" />
                Instant SMS alerts
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-status-quiet shrink-0" />
                Priority scanning
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-status-quiet shrink-0" />
                Faster notifications
              </li>
            </ul>
            <button
              onClick={() => navigate("/app?tab=sniper")}
              className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity"
            >
              Start tracking permits
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={28} className="text-muted-foreground" />
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground mb-2">
              Payment received
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your subscription is being activated. It may take a moment to reflect — try refreshing in a minute.
            </p>
            <button
              onClick={() => navigate("/app?tab=sniper")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionSuccessPage;
