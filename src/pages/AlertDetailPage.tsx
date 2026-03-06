import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ExternalLink, Eye, ArrowLeft, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const URGENCY_PHRASES = [
  "Act fast — permits go quickly",
  "Don't wait — spots vanish fast",
  "Move quick — others are watching too",
];

const AlertDetailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const permitName = params.get("permit") ?? "Permit";
  const parkName = params.get("park") ?? "";
  const rawDates = params.get("dates") ?? "";
  const bookingUrl = params.get("url") ?? "https://www.recreation.gov";
  const watchId = params.get("wid") ?? "";

  const dates = useMemo(() => {
    if (!rawDates) return [];
    return rawDates.split(",").map((d) => d.trim()).filter(Boolean);
  }, [rawDates]);

  const formattedDates = useMemo(() => {
    return dates.map((d) => {
      try {
        return new Date(d).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      } catch {
        return d;
      }
    });
  }, [dates]);

  // Urgency countdown
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setPhraseIdx((i) => (i + 1) % URGENCY_PHRASES.length), 4000);
    return () => clearInterval(iv);
  }, []);

  // Capture state
  const [captured, setCaptured] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleBook = () => {
    window.open(bookingUrl, "_blank", "noopener");
  };

  const handleCapture = async () => {
    setShowCelebration(true);
    setCaptured(true);

    // Log capture if we have a watch ID
    if (watchId) {
      try {
        await supabase
          .from("active_watches")
          .update({ status: "captured", is_active: false })
          .eq("id", watchId);
      } catch (e) {
        console.error("Failed to log capture:", e);
      }
    }

    // Auto-dismiss celebration after 4s and go to app
    setTimeout(() => navigate("/app?tab=sniper"), 4000);
  };

  const handleKeepWatching = () => {
    navigate("/app?tab=sniper");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="text-center space-y-5"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-7xl mx-auto"
              >
                🐻
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <PartyPopper className="h-8 w-8 text-secondary mx-auto mb-2" />
                <h2 className="text-2xl font-heading font-bold text-foreground">
                  Amazing! You got it.
                </h2>
                <p className="text-muted-foreground font-body mt-2">
                  Enjoy {parkName || "the adventure"}! 🎉
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back nav */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate("/app?tab=sniper")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground font-body hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Alerts
        </button>
      </div>

      {/* Coral banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 rounded-xl bg-secondary px-5 py-5 flex items-center gap-3"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Zap className="h-7 w-7 text-secondary-foreground" fill="currentColor" />
        </motion.div>
        <h1 className="text-xl font-heading font-bold text-secondary-foreground">
          Permit Available Now
        </h1>
      </motion.div>

      {/* Permit details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-5 pt-6 space-y-2"
      >
        <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">
          {permitName}
        </h2>
        {parkName && (
          <p className="text-sm font-body text-muted-foreground">{parkName}</p>
        )}

        {formattedDates.length > 0 && (
          <div className="pt-2 space-y-1">
            {formattedDates.map((d, i) => (
              <p key={i} className="text-lg font-body font-semibold text-status-found">
                {d}
              </p>
            ))}
          </div>
        )}
      </motion.div>

      {/* Urgency ticker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="px-5 pt-5"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary" />
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={phraseIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-body font-medium text-muted-foreground italic"
            >
              {URGENCY_PHRASES[phraseIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* CTAs */}
      <div className="flex-1" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-5 pb-8 space-y-4"
      >
        {/* Primary CTA */}
        <Button
          onClick={handleBook}
          className="w-full h-14 text-base font-body font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl shadow-lg"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Book on Recreation.gov →
        </Button>

        {/* Mark as captured */}
        {!captured && (
          <button
            onClick={handleCapture}
            className="w-full text-center text-sm font-body text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            I already booked it — mark as captured
          </button>
        )}

        {/* Keep watching */}
        <button
          onClick={handleKeepWatching}
          className="w-full text-center text-xs font-body text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
        >
          This date doesn't work — keep watching
        </button>
      </motion.div>
    </div>
  );
};

export default AlertDetailPage;
