import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ExternalLink, ArrowLeft, PartyPopper, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const URGENCY_PHRASES = [
  "Act fast — permits go quickly",
  "Don't wait — spots vanish fast",
  "Move quick — others are watching too",
];

const MAX_VISIBLE_DATES = 5;

interface ParsedDate {
  raw: string;
  formatted: string;
  spots: number | null; // null = unknown count
}

function parseAvailableDates(rawDates: string): ParsedDate[] {
  if (!rawDates) return [];
  return rawDates
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((raw) => {
      // Support format "2026-03-10:3" (date:spots) or plain "2026-03-10"
      const [dateStr, spotsStr] = raw.split(":");
      const spots = spotsStr ? parseInt(spotsStr, 10) : null;
      let formatted: string;
      try {
        formatted = new Date(dateStr).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        formatted = dateStr;
      }
      return { raw: dateStr, formatted, spots: Number.isNaN(spots) ? null : spots };
    });
}

function isConsecutiveBatch(dates: ParsedDate[]): boolean {
  if (dates.length < 3) return false;
  const sorted = dates
    .map((d) => new Date(d.raw).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);
  if (sorted.length < 3) return false;
  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 1;
    }
  }
  return false;
}

function ScarcityLabel({ spots }: { spots: number | null }) {
  if (spots === null) {
    return (
      <span className="text-xs font-semibold font-body px-2.5 py-1 rounded-full bg-status-found/10 text-status-found">
        Spots available
      </span>
    );
  }
  if (spots === 1) {
    return (
      <span className="text-xs font-semibold font-body px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
        1 spot left
      </span>
    );
  }
  if (spots <= 3) {
    return (
      <span className="text-xs font-semibold font-body px-2.5 py-1 rounded-full bg-secondary/20 text-secondary-foreground">
        {spots} spots — limited
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold font-body px-2.5 py-1 rounded-full bg-status-found/10 text-status-found">
      {spots} spots
    </span>
  );
}

const AlertDetailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const permitName = params.get("permit") ?? "Permit";
  const parkName = params.get("park") ?? "";
  const rawDates = params.get("dates") ?? "";
  const bookingUrl = params.get("url") ?? "https://www.recreation.gov";
  const watchId = params.get("wid") ?? "";

  const dates = useMemo(() => parseAvailableDates(rawDates), [rawDates]);
  const isBatchRelease = useMemo(() => isConsecutiveBatch(dates), [dates]);

  const hasDeepLink = bookingUrl.includes("/permits/");
  const fallbackMessage = !hasDeepLink
    ? "Opening Recreation.gov — select the permit from the calendar."
    : null;

  // Expand state for "+X more" dates
  const [expanded, setExpanded] = useState(false);
  const visibleDates = expanded ? dates : dates.slice(0, MAX_VISIBLE_DATES);
  const hiddenCount = dates.length - MAX_VISIBLE_DATES;

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
    const FALLBACK_URL = "https://www.recreation.gov";
    let targetUrl = FALLBACK_URL;
    try {
      const parsed = new URL(bookingUrl);
      if (
        parsed.protocol === "https:" &&
        (parsed.hostname === "recreation.gov" || parsed.hostname === "www.recreation.gov")
      ) {
        targetUrl = bookingUrl;
      } else {
        console.warn(`AlertDetailPage: rejected bookingUrl — invalid host or protocol: ${bookingUrl}`);
      }
    } catch {
      console.warn(`AlertDetailPage: rejected bookingUrl — malformed URL: ${bookingUrl}`);
    }
    window.open(targetUrl, "_blank", "noopener");
  };

  const handleCapture = async () => {
    setShowCelebration(true);
    setCaptured(true);
    if (watchId) {
      try {
        await supabase
          .from("user_watchers")
          .update({ status: "captured", is_active: false })
          .eq("id", watchId);
      } catch (e) {
        console.error("Failed to log capture:", e);
      }
    }
    setTimeout(() => navigate("/app?tab=sniper"), 4000);
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

      {/* AVAILABILITY DETECTED banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 rounded-[18px] bg-secondary px-5 py-5 flex items-center gap-3"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Zap className="h-7 w-7 text-secondary-foreground" fill="currentColor" />
        </motion.div>
        <h1 className="text-xl font-heading font-bold text-secondary-foreground">
          Availability Detected
        </h1>
      </motion.div>

      {/* Permit name + park */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-5 pt-6 space-y-1"
      >
        <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">
          {permitName}
        </h2>
        {parkName && (
          <p className="text-sm font-body text-muted-foreground">{parkName}</p>
        )}
      </motion.div>

      {/* Available Dates */}
      {dates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-5 pt-5 space-y-3"
        >
          <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
            Available Dates
          </p>

          {/* Batch release banner */}
          {isBatchRelease && (
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs font-body text-muted-foreground leading-relaxed">
                Pattern detected: multiple dates opened together. These releases are often claimed quickly.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {visibleDates.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-card rounded-lg px-3 py-2.5 border border-border"
              >
                <span className="text-sm font-body font-semibold text-foreground">
                  {d.formatted}
                </span>
                <ScarcityLabel spots={d.spots} />
              </div>
            ))}

            {/* Expand more dates inline */}
            {hiddenCount > 0 && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-body font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown size={14} />
                +{hiddenCount} more date{hiddenCount > 1 ? "s" : ""} available
              </button>
            )}
          </div>
        </motion.div>
      )}

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

      {/* Spacer to push CTAs to bottom */}
      <div className="flex-1" />

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-5 pb-6 space-y-3"
      >
        {/* Primary CTA */}
        <Button
          onClick={handleBook}
          className="w-full h-14 text-base font-body font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl shadow-lg"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Claim on Recreation.gov →
        </Button>

        {fallbackMessage && (
          <p className="text-center text-xs font-body text-muted-foreground/70">
            {fallbackMessage}
          </p>
        )}

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
          onClick={() => navigate("/app?tab=sniper")}
          className="w-full text-center text-xs font-body text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
        >
          This date doesn't work — keep watching
        </button>

        {/* Disclaimer */}
        <p className="text-center text-[11px] font-body text-muted-foreground/50 leading-relaxed px-4">
          Availability may change quickly. Check Recreation.gov to confirm current availability before booking.
        </p>

        {/* Pro upgrade — visually secondary, at the very bottom */}
        <div className="pt-3 border-t border-border mt-2">
          <p className="text-center text-xs font-body text-muted-foreground/60 leading-relaxed">
            Want faster scans and multi-park tracking?{" "}
            <button
              onClick={() => navigate("/app?tab=sniper&upgrade=1")}
              className="text-secondary font-semibold hover:underline"
            >
              Upgrade to Pro
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AlertDetailPage;
