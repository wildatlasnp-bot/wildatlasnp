import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/contexts/ProStatusContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import posthog from "@/lib/posthog";
import halfDomeNight from "@/assets/landing-halfdome-night.jpg";
import { PARK_COLORS } from "@/lib/parks";
import { useLiveAlertPreview } from "@/hooks/useLiveAlertPreview";

// Park list for the landing strip — order intentional (signature parks first).
const LANDING_PARKS: Array<{ label: string; color: string }> = [
  { label: "YOSEMITE", color: PARK_COLORS.yosemite },
  { label: "ZION", color: PARK_COLORS.zion },
  { label: "GLACIER", color: PARK_COLORS.glacier },
  { label: "GRAND CANYON", color: PARK_COLORS.grand_canyon },
  { label: "GRAND TETON", color: PARK_COLORS.grand_teton },
  { label: "ARCHES", color: PARK_COLORS.arches },
  { label: "ROCKY MOUNTAIN", color: PARK_COLORS.rocky_mountain },
  { label: "RAINIER", color: PARK_COLORS.rainier },
];




const scrollReveal = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/**
 * Reveal — scroll-triggered fade + slight rise. Honors prefers-reduced-motion
 * by collapsing to an instant fade. Single-shot (once: true) so the section
 * sits still after entering. Uses a generous margin so the reveal completes
 * before the content is fully on-screen.
 */
const Reveal = ({
  children,
  delay = 0,
  y = 24,
  duration = 0.9,
  as: Tag = "div",
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  as?: "div" | "section" | "article" | "li" | "ul" | "header" | "p";
  className?: string;
  style?: React.CSSProperties;
}) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag] as typeof motion.div;
  return (
    <MotionTag
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: reduce ? 0.4 : duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
      style={style}
    >
      {children}
    </MotionTag>
  );
};

/**
 * Pricing comparison cell — renders booleans as a hairline checkmark or em-dash,
 * and strings as Cormorant text. Tone controls emphasis (highlight = green serif).
 */
const PricingCell = ({
  value,
  tone,
  isMobile,
}: {
  value: string | boolean;
  tone: "default" | "muted" | "highlight";
  isMobile: boolean;
}) => {
  const baseColor =
    tone === "highlight"
      ? "#2F6F4E"
      : tone === "muted"
        ? "rgba(26, 47, 30, 0.7)"
        : "#1A2F1E";

  if (value === true) {
    return (
      <div
        aria-label="Included"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: isMobile ? 16 : 18,
          color: baseColor,
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        ✓
      </div>
    );
  }
  if (value === false) {
    return (
      <div
        aria-label="Not included"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: isMobile ? 18 : 20,
          color: "rgba(26, 47, 30, 0.25)",
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        —
      </div>
    );
  }
  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: tone === "highlight" ? "italic" : "normal",
        fontSize: isMobile ? 16 : 19,
        lineHeight: 1.2,
        color: baseColor,
        letterSpacing: "-0.005em",
        textAlign: "center",
      }}
    >
      {value}
    </div>
  );
};

/**
 * ParallaxPhoto — the Half Dome plate with a slow upward drift as the section
 * scrolls through the viewport. Movement is constrained so the image never
 * reveals letterboxing. Reduced-motion users get a static image.
 */
const ParallaxPhoto = ({
  isNarrow,
  children,
}: {
  isNarrow: boolean;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-30, 30]);
  const imgScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.06, 1.12]);
  const captionY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [16, -16]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        height: isNarrow ? 420 : 560,
        overflow: "hidden",
        background: "#0B1A22",
      }}
    >
      <motion.img
        src={halfDomeNight}
        alt="Half Dome under moonlight in Yosemite — the hour permits return"
        loading="lazy"
        width={1920}
        height={1080}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          y: imgY,
          scale: imgScale,
          willChange: "transform",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(240,237,234,1) 0%, rgba(240,237,234,0.4) 6%, rgba(11,26,34,0) 22%, rgba(11,26,34,0) 60%, rgba(11,26,34,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
      <motion.div style={{ y: captionY, position: "absolute", inset: 0 }}>
        {children}
      </motion.div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PricingSkeleton
   ───────────────────────────────────────────────────────────────
   Renders the EXACT same grid skeleton as the real comparison
   table (same column template, same row count, same paddings) so
   that swapping skeleton → table during auth restore or Stripe
   checkout redirect produces ZERO layout shift.

   Visual treatment:
   • Calm "breathing" opacity loop (1.6s, ease-in-out) — never
     a fast SaaS shimmer; matches the editorial Cormorant tone.
   • Bars use the same hairline color (#1A2F1E @ 0.08–0.14) as
     real table dividers so the page reads as "settling" rather
     than "broken".
   • Honors prefers-reduced-motion via Framer Motion's hook.
   ═══════════════════════════════════════════════════════════════ */
const PricingSkeleton = ({ isMobile }: { isMobile: boolean }) => {
  const reduce = useReducedMotion();
  const breathe = reduce
    ? { opacity: 0.6 }
    : {
        opacity: [0.45, 0.85, 0.45],
        transition: {
          duration: 1.6,
          repeat: Infinity,
          ease: [0.4, 0, 0.2, 1] as const,
        },
      };

  // Bar atom — keeps every skeleton block consistent
  const Bar = ({
    width,
    height,
    align = "left",
    delay = 0,
  }: {
    width: number | string;
    height: number;
    align?: "left" | "center";
    delay?: number;
  }) => (
    <div
      style={{
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      <motion.div
        animate={breathe}
        transition={
          reduce
            ? undefined
            : {
                duration: 1.6,
                repeat: Infinity,
                ease: [0.4, 0, 0.2, 1] as const,
                delay,
              }
        }
        style={{
          width,
          height,
          borderRadius: 2,
          background: "rgba(26, 47, 30, 0.10)",
        }}
      />
    </div>
  );

  // Locks the row template to the real table — single source of truth
  const gridTemplate = isMobile ? "1.2fr 1fr 1fr" : "1.6fr 1fr 1fr";
  const rowGap = isMobile ? 12 : 24;

  // 7 capability rows in the real table — match exactly
  const skeletonRows = Array.from({ length: 7 });

  return (
    <div
      role="presentation"
      aria-hidden="true"
      aria-busy="true"
      aria-label="Loading pricing"
      style={{
        borderTop: "1px solid rgba(26, 47, 30, 0.22)",
      }}
    >
      {/* COLUMN HEADERS — mirrors the price-row vertical rhythm */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          alignItems: "end",
          gap: rowGap,
          padding: isMobile ? "28px 0 24px" : "40px 0 32px",
          borderBottom: "1px solid rgba(26, 47, 30, 0.22)",
        }}
      >
        {/* "Capability" label slot */}
        <Bar width={72} height={9} />

        {/* Free header column — reserves space for label + price + caption */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 18 }}>
          <Bar width={36} height={9} align="center" delay={0.05} />
          <Bar width={isMobile ? 48 : 64} height={isMobile ? 32 : 44} align="center" delay={0.1} />
          <Bar width={52} height={11} align="center" delay={0.15} />
        </div>

        {/* Pro header column — reserves "Recommended" tag + label + price + caption */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Bar width={84} height={9} align="center" delay={0.08} />
          <Bar width={32} height={9} align="center" delay={0.12} />
          <Bar width={isMobile ? 56 : 72} height={isMobile ? 32 : 44} align="center" delay={0.16} />
          <Bar width={56} height={11} align="center" delay={0.2} />
        </div>
      </div>

      {/* CAPABILITY ROWS — same count + spacing as the real table */}
      {skeletonRows.map((_, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
            alignItems: "center",
            gap: rowGap,
            padding: isMobile ? "18px 0" : "22px 0",
            borderBottom:
              idx === skeletonRows.length - 1
                ? "1px solid rgba(26, 47, 30, 0.22)"
                : "1px solid rgba(26, 47, 30, 0.08)",
          }}
        >
          {/* Label — varied widths so it doesn't feel mechanical */}
          <Bar
            width={["62%", "48%", "70%", "55%", "45%", "60%", "40%"][idx] ?? "55%"}
            height={isMobile ? 12 : 14}
            delay={idx * 0.04}
          />
          {/* Free cell */}
          <Bar width={isMobile ? 38 : 56} height={isMobile ? 12 : 14} align="center" delay={idx * 0.04 + 0.03} />
          {/* Pro cell */}
          <Bar width={isMobile ? 44 : 64} height={isMobile ? 12 : 14} align="center" delay={idx * 0.04 + 0.06} />
        </div>
      ))}

      {/* CTA row spacer — same paddingTop as the real CTA row to lock height */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          alignItems: "center",
          gap: rowGap,
          paddingTop: isMobile ? 28 : 36,
        }}
      >
        <div aria-hidden="true" />
        <Bar width={isMobile ? 80 : 110} height={isMobile ? 16 : 22} align="center" delay={0.3} />
        <Bar width={isMobile ? 80 : 130} height={isMobile ? 16 : 22} align="center" delay={0.36} />
      </div>
    </div>
  );
};

/**
 * LiveAlertPreview — stateful demo of the two-tone severity system.
 *
 * Lets visitors flip between "Closure" (high-severity, amber bar, traffic
 * wording) and "Information" (low-severity, green seam, calm wording) so
 * they can feel the editorial rules govern both copy and chrome.
 *
 * The banner re-renders with a soft cross-fade + 4px lift driven by the
 * AnimatePresence key tied to the current severity. Honors reduced-motion.
 */
type AlertSeverity = "closure" | "info";

const ALERT_PRESETS: Record<
  AlertSeverity,
  {
    accent: string; // border + dot
    accentSoft: string; // pill bg
    accentInk: string; // pill text + status text
    surface: string; // banner bg
    badge: string; // pill label
    location: string;
    headlineLead: string; // bold lead phrase
    headlineTail: string; // italic tail phrase
    body: string;
    posted: string;
    status: string;
  }
> = {
  closure: {
    accent: "#C9A96E",
    accentSoft: "rgba(201, 169, 110, 0.22)",
    accentInk: "#8B6914",
    surface: "rgba(201, 169, 110, 0.10)",
    badge: "Active closure",
    location: "Yosemite · Tioga Pass",
    headlineLead: "Tioga Road closed —",
    headlineTail: "heavy traffic re-routed via 140",
    body:
      "Snowpack still measures 142% of normal at Tuolumne. Plan for a 38-minute detour through El Portal until the road crew clears the upper switchbacks.",
    posted: "Posted 06:14",
    status: "Ongoing",
  },
  info: {
    accent: "#2F6F4E",
    accentSoft: "rgba(47, 111, 78, 0.14)",
    accentInk: "#2F6F4E",
    surface: "rgba(47, 111, 78, 0.06)",
    badge: "Field note",
    location: "Glacier · Going-to-the-Sun",
    headlineLead: "Logan Pass shuttle resumed —",
    headlineTail: "no traffic impact",
    body:
      "First west-bound run leaves Apgar at 07:00. Reservation window for the alpine corridor opens 60 days out, on a rolling cadence.",
    posted: "Posted 04:22",
    status: "Informational",
  },
};

const LiveAlertPreview = ({ isMobile }: { isMobile: boolean }) => {
  const [severity, setSeverity] = useState<AlertSeverity>("closure");
  const prefersReducedMotion = useReducedMotion();
  const preset = ALERT_PRESETS[severity];

  const tabs: { id: AlertSeverity; label: string }[] = [
    { id: "closure", label: "Closure" },
    { id: "info", label: "Information" },
  ];

  return (
    <div>
      {/* Severity toggle — segmented, 44px tall, keyboard-navigable */}
      <div
        role="tablist"
        aria-label="Alert severity"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: 4,
          marginBottom: isMobile ? 18 : 24,
          background: "rgba(26, 47, 30, 0.05)",
          border: "1px solid rgba(26, 47, 30, 0.08)",
          borderRadius: 999,
        }}
      >
        {tabs.map((tab) => {
          const active = severity === tab.id;
          const tabAccent = ALERT_PRESETS[tab.id].accent;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSeverity(tab.id)}
              className="alert-severity-tab"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 36,
                padding: "0 16px",
                border: "none",
                borderRadius: 999,
                background: active ? "#1A2F1E" : "transparent",
                color: active ? "#F0EDEA" : "rgba(26, 47, 30, 0.65)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition:
                  "background 220ms cubic-bezier(0.4, 0, 0.2, 1), color 220ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: tabAccent,
                  opacity: active ? 1 : 0.6,
                  transition: "opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Stateful banner — keyed on severity for a soft cross-fade */}
      <motion.article
        key={severity}
        initial={
          prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        aria-label={`Example ${severity === "closure" ? "closure" : "information"} alert`}
        aria-live="polite"
        style={{
          position: "relative",
          background: preset.surface,
          borderLeft: `4px solid ${preset.accent}`,
          borderRadius: 4,
          padding: isMobile ? "18px 18px 18px 20px" : "22px 28px 22px 28px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
          gap: isMobile ? 12 : 24,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: preset.accentSoft,
                color: preset.accentInk,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: preset.accent,
                }}
              />
              {preset.badge}
            </span>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.55)",
              }}
            >
              {preset.location}
            </span>
          </div>

          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
              fontSize: isMobile ? 21 : 24,
              lineHeight: 1.2,
              color: "#1A2F1E",
              margin: 0,
              marginBottom: 6,
              letterSpacing: "-0.01em",
            }}
          >
            {preset.headlineLead}{" "}
            <span
              style={{
                fontStyle: "italic",
                color:
                  severity === "closure"
                    ? preset.accentInk
                    : "rgba(26, 47, 30, 0.55)",
              }}
            >
              {preset.headlineTail}
            </span>
          </h3>

          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: isMobile ? 13.5 : 14,
              lineHeight: 1.55,
              color: "rgba(26, 47, 30, 0.7)",
              margin: 0,
            }}
          >
            {preset.body}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            alignItems: isMobile ? "center" : "flex-end",
            justifyContent: isMobile ? "space-between" : "flex-start",
            gap: 6,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(26, 47, 30, 0.5)",
            minWidth: isMobile ? "auto" : 96,
          }}
        >
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {preset.posted}
          </span>
          <span style={{ color: preset.accentInk, fontWeight: 500 }}>
            {preset.status}
          </span>
        </div>
      </motion.article>

      {/* Focus-visible ring for the severity tabs (inline styles can't reach pseudo-states). */}
      <style>{`
        .alert-severity-tab { outline: none; -webkit-tap-highlight-color: transparent; }
        .alert-severity-tab:focus-visible {
          box-shadow: 0 0 0 2px #F0EDEA, 0 0 0 4px rgba(47, 111, 78, 0.55);
        }
      `}</style>
    </div>
  );
};

const LandingPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  // Local "narrow" breakpoint for the marketing page only — covers the 768–900px tablet gap.
  // Do NOT replace useIsMobile (the authenticated app depends on it at 768).
  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const heroRef = useRef<HTMLElement>(null);

  // Honest "live scanner" indicator — ticks on a 6s cadence to feel alive
  // without faking specific scan results. Pauses for reduced-motion users.
  const [secondsSinceSweep, setSecondsSinceSweep] = useState(2);
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setSecondsSinceSweep((s) => (s >= 8 ? 1 : s + 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);


  const navigate = useNavigate();
  const { toast } = useToast();
  const [proLoading, setProLoading] = useState(false);
  const { isPro, loading: proStatusLoading } = useProStatus();

  /**
   * Persisted CTA intent
   * ────────────────────
   * Auth restore (1st paint after refresh) and the round-trip through
   * Stripe Checkout both leave a small window where `user` flips from
   * `undefined → null → User` and `isPro` flips back to its default
   * `false`. Without persistence the Pro CTA would visibly flicker:
   *   "Upgrade to Pro" → "Manage subscription" → "Upgrade to Pro"
   *
   * We mirror the *last known* CTA intent into sessionStorage and
   * hydrate it *synchronously* on first render. Once the live auth +
   * pro status finish resolving (`authLoading === false` &&
   * `proStatusLoading === false`) we recompute the truth and write it
   * back. While anything is still loading we keep showing the
   * persisted snapshot — no flash, no destination jump.
   */
  type CtaIntent = "signup" | "upgrade" | "manage";
  const CTA_INTENT_KEY = "wa.landing.proCtaIntent";

  const readPersistedIntent = (): CtaIntent | null => {
    if (typeof window === "undefined") return null;
    try {
      const v = window.sessionStorage.getItem(CTA_INTENT_KEY);
      return v === "signup" || v === "upgrade" || v === "manage" ? v : null;
    } catch {
      return null;
    }
  };

  const computeIntent = (): CtaIntent => {
    if (!user) return "signup";
    return isPro ? "manage" : "upgrade";
  };

  const [ctaIntent, setCtaIntent] = useState<CtaIntent>(
    () => readPersistedIntent() ?? "signup",
  );

  // Once auth + pro status are settled, reconcile and persist the truth.
  useEffect(() => {
    if (authLoading || proStatusLoading) return;
    const next = computeIntent();
    setCtaIntent(next);
    try {
      window.sessionStorage.setItem(CTA_INTENT_KEY, next);
    } catch {
      // sessionStorage may be unavailable (Safari private mode, etc.) — degrade silently.
    }
    // We intentionally don't include computeIntent in deps; the value
    // is fully derived from the two dependencies below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, proStatusLoading, user, isPro]);

  // Free CTA destination — also derived from intent, so it stays stable
  // through the same auth-restore window.
  const ctaPath = ctaIntent === "signup" ? "/auth?signup=true" : "/app";

  // Pro CTA copy is driven by the persisted intent.
  const proCtaLabel = (() => {
    if (ctaIntent === "manage") return isMobile ? "Manage Pro" : "Manage subscription";
    if (ctaIntent === "upgrade") return isMobile ? "Go Pro" : "Upgrade to Pro";
    return isMobile ? "Go Pro" : "Upgrade to Pro";
  })();

  const trackCta = (event: string) => {
    try {
      posthog.capture(event, {
        source: "landing_page",
        variant: "editorial_redesign_2026_04",
        device: isMobile ? "mobile" : "desktop",
        cta_intent: ctaIntent,
      });
    } catch {
      // Never block navigation on analytics failure
    }
  };

  const handleProCheckout = async () => {
    // Route by persisted intent so behavior matches the visible label.
    if (ctaIntent === "signup" || !user) {
      navigate("/auth?signup=true");
      return;
    }
    if (ctaIntent === "manage") {
      // Existing Pro subscriber — open the customer portal instead of
      // attempting another checkout.
      setProLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("customer-portal");
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, "_blank");
        } else {
          throw new Error("No portal URL returned");
        }
      } catch (e: any) {
        console.error("Customer portal error:", e);
        toast({ title: "Trail hiccup", description: "Couldn't open billing. Please try again!" });
      } finally {
        setProLoading(false);
      }
      return;
    }
    setProLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.error === "already_subscribed") {
        toast({ title: "Already subscribed!", description: "You're already a Pro member." });
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      console.error("Checkout error:", e);
      toast({ title: "Trail hiccup", description: "Couldn't start checkout. Please try again!" });
    } finally {
      setProLoading(false);
    }
  };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WildAtlas",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "WildAtlas continuously monitors Recreation.gov and texts you the instant a permit cancellation drops for national parks like Yosemite and Rainier.",
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <Helmet>
        <title>WildAtlas — National Park Permit Alerts</title>
        <meta
          name="description"
          content="WildAtlas continuously monitors Recreation.gov and texts you the instant a permit cancellation drops. Yosemite, Rainier & more."
        />
        <link rel="canonical" href={`${siteUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: "#F0EDEA", backgroundImage: "none" }}>
        {/* ── Nav (editorial masthead) ── */}
        <nav
          className="sticky top-0 z-50"
          style={{
            background: "rgba(240, 237, 234, 0.92)",
            backdropFilter: "saturate(140%) blur(12px)",
            WebkitBackdropFilter: "saturate(140%) blur(12px)",
            borderBottom: "1px solid rgba(26, 47, 30, 0.14)",
          }}
        >
          <div
            className="mx-auto flex items-center justify-between"
            style={{
              maxWidth: 1200,
              height: isMobile ? 60 : 72,
              padding: isMobile ? "0 20px" : isNarrow ? "0 32px" : "0 56px",
              gap: 24,
            }}
          >
            {/* Brand mark — wordmark + small coordinate stamp beneath */}
            <Link
              to="/"
              style={{
                display: "inline-flex",
                flexDirection: "column",
                gap: 2,
                textDecoration: "none",
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: isMobile ? 22 : 26,
                  fontWeight: 500,
                  color: "#1A2F1E",
                  letterSpacing: "-0.005em",
                }}
              >
                WildAtlas
              </span>
              {!isMobile && (
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.42)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  Est. MMXXVI · Field Notes
                </span>
              )}
            </Link>

            {/* Section links + CTA */}
            <div className="flex items-center" style={{ gap: isMobile ? 16 : 32 }}>
              {!isNarrow && (
                <>
                  <a
                    href="#how-it-works"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(26, 47, 30, 0.65)",
                      textDecoration: "none",
                      transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(26, 47, 30, 0.65)")}
                  >
                    The Method
                  </a>
                  <a
                    href="#pricing"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(26, 47, 30, 0.65)",
                      textDecoration: "none",
                      transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(26, 47, 30, 0.65)")}
                  >
                    Terms of Use
                  </a>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 1,
                      height: 16,
                      background: "rgba(26, 47, 30, 0.18)",
                    }}
                  />
                </>
              )}
              <Link
                to="/auth?signup=true"
                onClick={() => trackCta("landing_nav_start_clicked")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: isMobile ? 16 : 18,
                  color: "#1A2F1E",
                  textDecoration: "none",
                  paddingBottom: 3,
                  borderBottom: "1px solid rgba(26, 47, 30, 0.4)",
                  whiteSpace: "nowrap",
                  transition: "border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1A2F1E")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(26, 47, 30, 0.4)")}
              >
                <span>Begin watching</span>
                <span aria-hidden="true" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
                  →
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — HERO  (Editorial grid, corner anchors)
            12-column asymmetric grid. Cream paper. Hairline rules
            anchor the corners — Vol stamp top-left, coordinates
            top-right, timestamp + scanner bottom-left, edition
            mark bottom-right. Headline sits off-center on cols 1–9.
            ═══════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          style={{
            background: "#F0EDEA",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Scanner + ambient keyframes (kept for the dissolved scanner line below) */}
          <style>{`
            @keyframes scannerHeartbeat {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.35); opacity: 0.85; }
            }
            @keyframes scannerRipple {
              0% { transform: scale(1); opacity: 0.4; }
              100% { transform: scale(2.8); opacity: 0; }
            }
            @keyframes heroRuleDraw {
              from { transform: scaleX(0); }
              to { transform: scaleX(1); }
            }
            @keyframes heroFadeUp {
              from { opacity: 0; transform: translateY(14px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-scanner-pulse],
              [data-hero-rule],
              [data-hero-fade] { animation: none !important; }
            }
          `}</style>

          <div
            className="mx-auto"
            style={{
              position: "relative",
              maxWidth: 1200,
              padding: isMobile
                ? "32px 20px 72px"
                : isNarrow
                ? "48px 32px 88px"
                : "56px 56px 112px",
              minHeight: isMobile ? "auto" : "82vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* ───── CORNER ANCHORS (top row) ───── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 24,
                marginBottom: isMobile ? 56 : 88,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.45)",
              }}
            >
              {/* Top-left: Vol stamp */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  data-hero-rule
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 28,
                    height: 1,
                    background: "rgba(26, 47, 30, 0.35)",
                    transformOrigin: "left center",
                    animation: "heroRuleDraw 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  }}
                />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  Vol. 01 — Field Notes
                </span>
              </div>

              {/* Top-right: coordinates (hidden on tightest mobile) */}
              {!isMobile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    37.7459° N · 119.5332° W
                  </span>
                  <span
                    data-hero-rule
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 1,
                      background: "rgba(26, 47, 30, 0.35)",
                      transformOrigin: "right center",
                      animation: "heroRuleDraw 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
                      animationDelay: "120ms",
                    }}
                  />
                </div>
              )}
            </div>

            {/* ───── HEADLINE — asymmetric, off-center ─────
                12-column grid: headline lives on cols 1–9, leaving
                col 10–12 for the pull-quote ornament on desktop. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isNarrow ? "1fr" : "repeat(12, 1fr)",
                gap: isMobile ? 24 : 32,
                alignItems: "end",
              }}
            >
              {/* Headline block */}
              <div
                style={{
                  gridColumn: isMobile || isNarrow ? "auto" : "1 / span 9",
                }}
              >
                <h1
                  data-hero-fade
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 400,
                    fontSize: isMobile ? 52 : isNarrow ? 72 : 108,
                    lineHeight: 0.96,
                    letterSpacing: "-0.03em",
                    color: "#1A2F1E",
                    margin: 0,
                    animation:
                      "heroFadeUp 1100ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  }}
                >
                  Permits return
                  <br />
                  at{" "}
                  <span
                    style={{
                      fontStyle: "italic",
                      color: "rgba(26, 47, 30, 0.78)",
                    }}
                  >
                    2:14 a.m.
                  </span>
                </h1>

                <p
                  data-hero-fade
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: isMobile ? 20 : 24,
                    lineHeight: 1.35,
                    color: "rgba(26, 47, 30, 0.6)",
                    margin: 0,
                    marginTop: isMobile ? 20 : 28,
                    maxWidth: 520,
                    animation:
                      "heroFadeUp 1100ms cubic-bezier(0.16, 1, 0.3, 1) both",
                    animationDelay: "180ms",
                  }}
                >
                  You sleep. Poko keeps the watch.
                </p>
              </div>

              {/* Editorial pull-quote ornament — desktop only */}
              {!isMobile && !isNarrow && (
                <aside
                  data-hero-fade
                  style={{
                    gridColumn: "10 / span 3",
                    paddingLeft: 20,
                    borderLeft: "1px solid rgba(26, 47, 30, 0.18)",
                    animation:
                      "heroFadeUp 1100ms cubic-bezier(0.16, 1, 0.3, 1) both",
                    animationDelay: "320ms",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(26, 47, 30, 0.4)",
                      margin: 0,
                      marginBottom: 12,
                    }}
                  >
                    § 01 · The Watcher
                  </p>
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 17,
                      lineHeight: 1.45,
                      color: "rgba(26, 47, 30, 0.72)",
                      margin: 0,
                    }}
                  >
                    "Cancellations arrive on no schedule. We hold the door
                    so you needn't."
                  </p>
                </aside>
              )}
            </div>

            {/* ───── SMS PROOF + CTA — left-aligned, integrated ───── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isNarrow ? "1fr" : "repeat(12, 1fr)",
                gap: isMobile ? 32 : 40,
                marginTop: isMobile ? 56 : 88,
                alignItems: "end",
              }}
            >
              {/* SMS bubble — anchored left on cols 1–5 */}
              <div
                data-hero-fade
                style={{
                  gridColumn: isMobile || isNarrow ? "auto" : "1 / span 5",
                  background: "#1A2F1E",
                  borderRadius: 22,
                  maxWidth: isMobile ? "100%" : 380,
                  padding: "20px 24px",
                  textAlign: "left",
                  animation:
                    "heroFadeUp 1100ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: "420ms",
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 12 }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.5)",
                    }}
                  >
                    WildAtlas · 2:14 AM
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      color: "rgba(240, 237, 234, 0.5)",
                    }}
                  >
                    now
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14.5,
                    lineHeight: 1.5,
                    color: "#F0EDEA",
                    margin: 0,
                  }}
                >
                  Half Dome cables —{" "}
                  <span style={{ color: "#C9A96E", fontWeight: 500 }}>
                    2 spots opened
                  </span>{" "}
                  for July 14. Window's short.
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12.5,
                    color: "#A8C4B8",
                    margin: 0,
                    marginTop: 10,
                  }}
                >
                  rec.gov/r/permitYOSE →
                </p>
              </div>

              {/* CTA column — cols 7–12, ghost link styling */}
              <div
                data-hero-fade
                style={{
                  gridColumn: isMobile || isNarrow ? "auto" : "7 / span 6",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMobile || isNarrow ? "flex-start" : "flex-start",
                  animation:
                    "heroFadeUp 1100ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: "560ms",
                }}
              >
                <Link
                  to="/auth?signup=true"
                  onClick={() => trackCta("landing_hero_cta_clicked")}
                  className="group"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 16,
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 26 : 34,
                    fontWeight: 400,
                    color: "#1A2F1E",
                    textDecoration: "none",
                    paddingBottom: 10,
                    borderBottom: "1px solid rgba(26, 47, 30, 0.45)",
                    transition: "border-color 240ms cubic-bezier(0.4, 0, 0.2, 1), color 240ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#1A2F1E";
                    e.currentTarget.style.color = "#0E1F12";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(26, 47, 30, 0.45)";
                    e.currentTarget.style.color = "#1A2F1E";
                  }}
                >
                  <span>Begin watching</span>
                  <span
                    aria-hidden="true"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: isMobile ? 18 : 22,
                      lineHeight: 1,
                      transform: "translateY(-1px)",
                      transition: "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>

                {/* Restrained meta — single line, no SaaS tropes */}
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.42)",
                    margin: 0,
                    marginTop: 18,
                  }}
                >
                  Free to begin · No card
                </p>
              </div>
            </div>

            {/* ───── BOTTOM CORNER ANCHORS — dissolved scanner + edition ───── */}
            <div
              style={{
                marginTop: isMobile ? 56 : 96,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.5)",
              }}
            >
              {/* Bottom-left: dissolved scanner — no pill, just typography + dot */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                }}
                aria-live="polite"
                aria-label={`Scanner active. Last sweep ${secondsSinceSweep} seconds ago.`}
              >
                <span
                  style={{
                    position: "relative",
                    width: 7,
                    height: 7,
                    display: "inline-block",
                  }}
                >
                  <span
                    data-scanner-pulse
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "#2F6F4E",
                      animation:
                        "scannerHeartbeat 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                  />
                  <span
                    data-scanner-pulse
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "#2F6F4E",
                      opacity: 0.35,
                      animation:
                        "scannerRipple 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      animationDelay: "-0.2s",
                    }}
                  />
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  Scanner live
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 18,
                    height: 1,
                    background: "rgba(26, 47, 30, 0.25)",
                  }}
                />
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: "rgba(26, 47, 30, 0.4)",
                  }}
                >
                  Sweep {String(secondsSinceSweep).padStart(2, "0")}s
                </span>
              </div>

              {/* Bottom-right: edition mark */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 18,
                    height: 1,
                    background: "rgba(26, 47, 30, 0.25)",
                  }}
                />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  Ed. MMXXVI · Spring
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2.5 — PHOTOGRAPHIC MOMENT (Half Dome at night)
            Single anchor that places the product in wilderness
            ═══════════════════════════════════════════════════ */}
        <ParallaxPhoto isNarrow={isNarrow}>
          {/* Overlay caption — left-anchored editorial field note (not centered) */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: isNarrow ? 32 : 56,
              padding: isNarrow ? "0 24px" : "0 56px",
              pointerEvents: "none",
              maxWidth: 1200,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              {/* Left: caption */}
              <div style={{ maxWidth: 520 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 24,
                      height: 1,
                      background: "rgba(240, 237, 234, 0.5)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.65)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Plate I · Yosemite
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: isNarrow ? 22 : 30,
                    lineHeight: 1.25,
                    letterSpacing: "-0.015em",
                    color: "#F0EDEA",
                    margin: 0,
                    WebkitFontSmoothing: "antialiased",
                    textShadow: "0 1px 24px rgba(0,0,0,0.45)",
                  }}
                >
                  Half Dome,{" "}
                  <span style={{ color: "rgba(240, 237, 234, 0.78)" }}>
                    awaiting its next traveller.
                  </span>
                </p>
              </div>

              {/* Right: coordinate stamp */}
              {!isNarrow && (
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(240, 237, 234, 0.55)",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    lineHeight: 1.7,
                  }}
                >
                  <div>37.7459° N</div>
                  <div>119.5332° W</div>
                  <div style={{ color: "rgba(240, 237, 234, 0.4)", marginTop: 4 }}>
                    02:14 · PST
                  </div>
                </div>
              )}
            </div>
          </div>
        </ParallaxPhoto>

        {/* ═══════════════════════════════════════════════════
            SECTION 3A — EDITORIAL PULL-QUOTE
            With pen-rule flourishes and an attribution stamp
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            background: "#F0EDEA",
            paddingTop: isNarrow ? 80 : 128,
            paddingBottom: isNarrow ? 64 : 96,
            paddingLeft: isNarrow ? 20 : 24,
            paddingRight: isNarrow ? 20 : 24,
          }}
        >
          <Reveal
            duration={1.1}
            y={20}
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
            }}
          >
            {/* Top hairline ornament */}
            <div
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 56,
                  height: 1,
                  background: "rgba(26, 47, 30, 0.3)",
                }}
              />
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#C9A96E",
                }}
              />
              <span
                style={{
                  display: "inline-block",
                  width: 56,
                  height: 1,
                  background: "rgba(26, 47, 30, 0.3)",
                }}
              />
            </div>

            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: isNarrow ? 28 : 40,
                lineHeight: 1.25,
                letterSpacing: "-0.015em",
                color: "#1A2F1E",
                margin: 0,
                textAlign: "center",
                WebkitFontSmoothing: "antialiased",
                maxWidth: 620,
              }}
            >
              "The wilderness keeps its own hours.{" "}
              <span style={{ color: "rgba(26, 47, 30, 0.6)" }}>
                So do we."
              </span>
            </p>

            {/* Attribution */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.45)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 1,
                  background: "rgba(26, 47, 30, 0.3)",
                }}
              />
              <span>The Watcher · Field Notes, MMXXVI</span>
            </div>
          </Reveal>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3B — THE FLEET
            Editorial listing of watched parks. No badge pills,
            no centered chip soup — left-aligned register with
            section heading and color hairlines.
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            background: "#F0EDEA",
            paddingTop: isMobile ? 16 : 24,
            paddingBottom: isMobile ? 56 : 88,
            paddingLeft: isMobile ? 20 : isNarrow ? 32 : 56,
            paddingRight: isMobile ? 20 : isNarrow ? 32 : 56,
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            {/* Section heading row */}
            <Reveal
              y={18}
              duration={0.9}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 24,
                marginBottom: isMobile ? 28 : 40,
                paddingBottom: isMobile ? 20 : 24,
                borderBottom: "1px solid rgba(26, 47, 30, 0.22)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.5)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 1,
                      background: "rgba(26, 47, 30, 0.35)",
                    }}
                  />
                  <span>§ 02 · The Fleet</span>
                </div>
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 28 : 36,
                    fontWeight: 400,
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: "#1A2F1E",
                    margin: 0,
                  }}
                >
                  Eight parks. One unbroken watch.
                </h2>
              </div>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.45)",
                  fontVariantNumeric: "tabular-nums",
                  paddingBottom: 4,
                }}
              >
                {LANDING_PARKS.length.toString().padStart(2, "0")} ·{" "}
                <span style={{ color: "rgba(26, 47, 30, 0.7)" }}>active</span>
              </span>
            </Reveal>

            {/* Park grid — typeset rows, color hairline as identifier */}
            <ul
              aria-label="Parks currently watched by WildAtlas"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr 1fr"
                  : isNarrow
                    ? "repeat(3, 1fr)"
                    : "repeat(4, 1fr)",
                rowGap: isMobile ? 20 : 28,
                columnGap: isMobile ? 16 : 32,
              }}
            >
              {LANDING_PARKS.map((park, idx) => (
                <motion.li
                  key={park.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                  transition={{
                    duration: 0.7,
                    delay: idx * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        color: "rgba(26, 47, 30, 0.4)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: isMobile ? 16 : 19,
                        lineHeight: 1.1,
                        color: "#1A2F1E",
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {park.label.charAt(0) + park.label.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <motion.span
                    aria-hidden="true"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                    transition={{
                      duration: 0.8,
                      delay: idx * 0.06 + 0.15,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      height: 2,
                      background: park.color,
                      opacity: 0.85,
                      transformOrigin: "left center",
                    }}
                  />
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3.5 — LIVE ALERT PREVIEW
            A tangible artifact: two real-shape banners showing
            the severity system (Closure vs. Information). Sits
            on cream paper before the dark Method chapter so users
            recognize the surface they'll see in-app and in email.
            ═══════════════════════════════════════════════════ */}
        <section
          aria-labelledby="live-alert-heading"
          style={{
            background: "#F0EDEA",
            paddingTop: isMobile ? 64 : 96,
            paddingBottom: isMobile ? 56 : 88,
            paddingLeft: isMobile ? 18 : isNarrow ? 32 : 56,
            paddingRight: isMobile ? 18 : isNarrow ? 32 : 56,
          }}
        >
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            {/* Editorial chapter mark — same vocabulary as other sections */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: isMobile ? 24 : 32,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.55)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 28,
                  height: 1,
                  background: "rgba(201, 169, 110, 0.5)",
                }}
              />
              <span style={{ color: "#8B6914" }}>§ 02½ · Live Alert</span>
            </div>

            <h2
              id="live-alert-heading"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isMobile ? 36 : isNarrow ? 52 : 64,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
                color: "#1A2F1E",
                margin: 0,
                marginBottom: isMobile ? 14 : 20,
                maxWidth: 760,
              }}
            >
              Two tones.{" "}
              <span style={{ fontStyle: "italic", color: "rgba(26, 47, 30, 0.55)" }}>
                One you act on.
              </span>
            </h2>

            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: isMobile ? 16 : 19,
                lineHeight: 1.55,
                color: "rgba(26, 47, 30, 0.7)",
                margin: 0,
                marginBottom: isMobile ? 28 : 36,
                maxWidth: 600,
              }}
            >
              Every notice arrives shaped by urgency. Switch the severity to
              see how the banner re-tunes its wording, badge, and accent.
            </p>

            {/* ───── Severity toggle + stateful banner ───── */}
            <LiveAlertPreview isMobile={isMobile} />

            {/* Footnote */}
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 14,
                color: "rgba(26, 47, 30, 0.55)",
                marginTop: isMobile ? 24 : 32,
                marginBottom: 0,
                maxWidth: 560,
              }}
            >
              Sourced from the National Park Service feed, refreshed every
              fifteen minutes. Pinned to your watched parks only.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            HAIRLINE TRANSITION — Cream to Forest
            A quiet bleed bar with a centered ornament that
            ushers the eye from the warm Fleet surface into the
            dark Method chapter. No copy, no badges — just a
            seam stitched between two materials.
            ═══════════════════════════════════════════════════ */}
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            height: isMobile ? 56 : 88,
            background: "linear-gradient(to bottom, #F0EDEA 0%, #F0EDEA 40%, #1A2F1E 60%, #1A2F1E 100%)",
            overflow: "hidden",
          }}
        >
          {/* Centered diamond ornament sitting exactly on the seam */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%) rotate(45deg)",
              width: 6,
              height: 6,
              background: "#C9A96E",
              boxShadow: "0 0 0 1px rgba(240, 237, 234, 0.7)",
            }}
          />
          {/* Faint horizontal hairlines flanking the ornament */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: "calc(50% + 24px)",
              top: "50%",
              height: 1,
              background:
                "linear-gradient(to right, rgba(26, 47, 30, 0) 0%, rgba(26, 47, 30, 0.18) 60%, rgba(201, 169, 110, 0.45) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              left: "calc(50% + 24px)",
              top: "50%",
              height: 1,
              background:
                "linear-gradient(to left, rgba(240, 237, 234, 0.18) 0%, rgba(240, 237, 234, 0.18) 60%, rgba(201, 169, 110, 0.45) 100%)",
            }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — THE METHOD (dark bleed, editorial chapters)
            Three steps, three distinct layouts. The clock at 2:14
            embeds inline in step ii rather than sitting as a
            centered band. Corner anchors frame the section.
            ═══════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          style={{
            background: "#1A2F1E",
            color: "#F0EDEA",
            // Tighter top padding on mobile so the headline sits closer to the
            // dark/cream transition without feeling crowded; matched bottom for rhythm.
            paddingTop: isMobile ? 44 : 88,
            paddingBottom: isMobile ? 48 : 88,
            // Slightly reduced horizontal padding on mobile gives the 44px display
            // serif room to breathe without clipping at the viewport edge.
            paddingLeft: isMobile ? 18 : 24,
            paddingRight: isMobile ? 18 : 24,
            position: "relative",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            {/* ───── Top corner anchors ───── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 24,
                // Tighter gap below the chapter mark on mobile so the headline
                // anchors higher in the viewport.
                marginBottom: isMobile ? 36 : 96,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(240, 237, 234, 0.55)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 28,
                    height: 1,
                    background: "rgba(201, 169, 110, 0.45)",
                  }}
                />
                <span style={{ color: "#C9A96E" }}>§ 03 · The Method</span>
              </div>
              {!isMobile && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    Three movements
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 1,
                      background: "rgba(240, 237, 234, 0.3)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* ───── Section headline ─────
                Mobile: explicit line breaks per phrase prevent unpredictable
                wrapping at 390px. Display size dropped to 38px and letter-spacing
                eased to -0.02em so "movements." never clips the right edge. */}
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isMobile ? 38 : isNarrow ? 64 : 88,
                lineHeight: isMobile ? 1.04 : 0.98,
                letterSpacing: isMobile ? "-0.02em" : "-0.03em",
                color: "#F0EDEA",
                margin: 0,
                marginBottom: isMobile ? 48 : 112,
                maxWidth: 880,
                // Belt-and-suspenders: prevent any orphan glyph from pushing
                // beyond the content box on the narrowest supported viewport.
                overflowWrap: "break-word",
              }}
            >
              Three movements.
              {isMobile ? <br /> : " "}
              <span style={{ fontStyle: "italic", color: "#A8C4B8" }}>
                One alert.
              </span>
              <br />
              The rest,{isMobile ? <br /> : " "}
              <span style={{ fontStyle: "italic", color: "rgba(240, 237, 234, 0.55)" }}>
                in the quiet hours.
              </span>
            </h2>

            {/* ════════════════════════════════════════
                STEP I — Wide left numeral, narrow text
                ════════════════════════════════════════ */}
            <motion.article
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -12% 0px" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isNarrow ? "1fr" : "200px 1fr",
                gap: isMobile ? 20 : 56,
                alignItems: "baseline",
                paddingTop: isMobile ? 28 : 44,
                paddingBottom: isMobile ? 56 : 88,
                borderTop: "1px solid rgba(240, 237, 234, 0.14)",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: isMobile ? 64 : 96,
                    fontWeight: 400,
                    lineHeight: 0.85,
                    color: "#C9A96E",
                    letterSpacing: "-0.03em",
                  }}
                >
                  i.
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(240, 237, 234, 0.4)",
                    marginTop: 16,
                  }}
                >
                  ~60 seconds
                </div>
              </div>
              <div style={{ maxWidth: 580 }}>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 26 : 34,
                    fontWeight: 400,
                    lineHeight: 1.15,
                    letterSpacing: "-0.015em",
                    color: "#F0EDEA",
                    margin: 0,
                    marginBottom: isMobile ? 14 : 18,
                  }}
                >
                  Name the permit you want.
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: isMobile ? 15 : 16,
                    lineHeight: 1.65,
                    color: "rgba(240, 237, 234, 0.7)",
                    margin: 0,
                  }}
                >
                  Park, permit, dates. About a minute. The last minute you'll
                  spend on it.
                </p>
              </div>
            </motion.article>

            {/* ════════════════════════════════════════
                STEP II — Inline clock ornament
                Asymmetric: text on the left, clock on the right
                ════════════════════════════════════════ */}
            <motion.article
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -12% 0px" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isNarrow ? "1fr" : "1fr 240px",
                gap: isMobile ? 32 : 56,
                alignItems: "center",
                paddingTop: isMobile ? 28 : 44,
                paddingBottom: isMobile ? 56 : 88,
                borderTop: "1px solid rgba(240, 237, 234, 0.14)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: isMobile ? 14 : 18 }}>
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: isMobile ? 28 : 36,
                      color: "#C9A96E",
                      lineHeight: 1,
                    }}
                  >
                    ii.
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.4)",
                    }}
                  >
                    Every two minutes · 24/7
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 28 : 40,
                    fontWeight: 400,
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: "#F0EDEA",
                    margin: 0,
                    marginBottom: isMobile ? 14 : 20,
                    maxWidth: 520,
                  }}
                >
                  Poko keeps watch while the park sleeps.
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: isMobile ? 15 : 16,
                    lineHeight: 1.65,
                    color: "rgba(240, 237, 234, 0.7)",
                    margin: 0,
                    maxWidth: 520,
                  }}
                >
                  Recreation.gov, swept every two minutes. The heaviest drops
                  arrive between{" "}
                  <span style={{ color: "#C9A96E", fontStyle: "italic" }}>
                    10 p.m. and 6 a.m.
                  </span>{" "}
                  We're awake.
                </p>
              </div>

              {/* Inline clock ornament — moved from centered position */}
              <div
                style={{
                  display: "flex",
                  justifyContent: isMobile ? "flex-start" : "center",
                  alignItems: "center",
                }}
                aria-hidden="true"
              >
                <div style={{ position: "relative" }}>
                  <svg
                    width={isMobile ? 132 : 200}
                    height={isMobile ? 132 : 200}
                    viewBox="0 0 120 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="55"
                      stroke="rgba(240, 237, 234, 0.22)"
                      strokeWidth="1"
                    />
                    {Array.from({ length: 12 }).map((_, i) => {
                      const angle = (i * 30 - 90) * (Math.PI / 180);
                      const isTwoOClock = i === 2;
                      const inner = isTwoOClock ? 42 : 48;
                      const outer = 52;
                      const x1 = 60 + Math.cos(angle) * inner;
                      const y1 = 60 + Math.sin(angle) * inner;
                      const x2 = 60 + Math.cos(angle) * outer;
                      const y2 = 60 + Math.sin(angle) * outer;
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={
                            isTwoOClock
                              ? "#C9A96E"
                              : "rgba(240, 237, 234, 0.32)"
                          }
                          strokeWidth={isTwoOClock ? 1.5 : 1}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {(() => {
                      const hourAngle = (67 - 90) * (Math.PI / 180);
                      const x2 = 60 + Math.cos(hourAngle) * 28;
                      const y2 = 60 + Math.sin(hourAngle) * 28;
                      return (
                        <line
                          x1="60"
                          y1="60"
                          x2={x2}
                          y2={y2}
                          stroke="#F0EDEA"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    {(() => {
                      const minuteAngle = (84 - 90) * (Math.PI / 180);
                      const x2 = 60 + Math.cos(minuteAngle) * 40;
                      const y2 = 60 + Math.sin(minuteAngle) * 40;
                      return (
                        <line
                          x1="60"
                          y1="60"
                          x2={x2}
                          y2={y2}
                          stroke="#F0EDEA"
                          strokeWidth="1"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    <circle cx="60" cy="60" r="2" fill="#C9A96E" />
                  </svg>
                  {/* Caption beneath the clock */}
                  <div
                    style={{
                      marginTop: 14,
                      textAlign: "center",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.45)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    02:14 · PST
                  </div>
                </div>
              </div>
            </motion.article>

            {/* ════════════════════════════════════════
                STEP III — Typography-led with marginalia timer
                ════════════════════════════════════════ */}
            <motion.article
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -12% 0px" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isNarrow ? "1fr" : "1fr 180px",
                gap: isMobile ? 24 : 56,
                alignItems: "end",
                paddingTop: isMobile ? 28 : 44,
                paddingBottom: isMobile ? 24 : 32,
                borderTop: "1px solid rgba(240, 237, 234, 0.14)",
              }}
            >
              <div style={{ maxWidth: 720 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: isMobile ? 16 : 22 }}>
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: isMobile ? 28 : 36,
                      color: "#C9A96E",
                      lineHeight: 1,
                    }}
                  >
                    iii.
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.4)",
                    }}
                  >
                    The window
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 30 : 48,
                    fontWeight: 400,
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    color: "#F0EDEA",
                    margin: 0,
                    marginBottom: isMobile ? 16 : 22,
                  }}
                >
                  The text arrives.{" "}
                  <span style={{ fontStyle: "italic", color: "#A8C4B8" }}>
                    Four minutes is the window.
                  </span>
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: isMobile ? 15 : 16,
                    lineHeight: 1.65,
                    color: "rgba(240, 237, 234, 0.7)",
                    margin: 0,
                    maxWidth: 560,
                  }}
                >
                  Tap the link. Book it. The permit is yours, provided you move
                  before the next refresh on Recreation.gov.
                </p>
              </div>

              {/* Marginalia timer — large oversized "04:00" in editorial style */}
              {!isMobile && !isNarrow && (
                <div
                  style={{
                    textAlign: "right",
                    paddingRight: 4,
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 84,
                      fontWeight: 400,
                      lineHeight: 0.85,
                      color: "rgba(201, 169, 110, 0.85)",
                      letterSpacing: "-0.04em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    04:00
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "rgba(240, 237, 234, 0.4)",
                      marginTop: 10,
                    }}
                  >
                    Median window
                  </div>
                </div>
              )}
            </motion.article>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            HAIRLINE TRANSITION — Forest to Cream (mirrored)
            Closes the Method chapter and ushers the eye back to
            cream paper for pricing. Same diamond ornament,
            inverted gradient direction.
            ═══════════════════════════════════════════════════ */}
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            height: isMobile ? 56 : 88,
            background: "linear-gradient(to bottom, #1A2F1E 0%, #1A2F1E 40%, #F0EDEA 60%, #F0EDEA 100%)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%) rotate(45deg)",
              width: 6,
              height: 6,
              background: "#C9A96E",
              boxShadow: "0 0 0 1px rgba(26, 47, 30, 0.7)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: "calc(50% + 24px)",
              top: "50%",
              height: 1,
              background:
                "linear-gradient(to right, rgba(240, 237, 234, 0.18) 0%, rgba(240, 237, 234, 0.18) 60%, rgba(201, 169, 110, 0.45) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              left: "calc(50% + 24px)",
              top: "50%",
              height: 1,
              background:
                "linear-gradient(to left, rgba(26, 47, 30, 0.18) 0%, rgba(26, 47, 30, 0.18) 60%, rgba(201, 169, 110, 0.45) 100%)",
            }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 4.5 — PRICING (Editorial comparison table)
            Hairline-ruled, no cards, no badges. Plans live as
            column headers; rows are capabilities. Pricing typography
            matches the hero (Cormorant), and CTAs sit in the foot
            of each column as ghost links.
            ═══════════════════════════════════════════════════ */}
        <section
          id="pricing"
          style={{
            background: "#F0EDEA",
            paddingTop: isMobile ? 56 : 88,
            paddingBottom: isMobile ? 64 : 96,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
          }}
        >
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            {/* ───── Section masthead ───── */}
            <Reveal
              y={20}
              duration={0.95}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 24,
                marginBottom: isMobile ? 40 : 64,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 280px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 18,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "rgba(26, 47, 30, 0.5)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 1,
                      background: "rgba(26, 47, 30, 0.35)",
                    }}
                  />
                  <span>§ 04 · Terms of Use</span>
                </div>
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 400,
                    fontSize: isMobile ? 38 : 56,
                    lineHeight: 1.02,
                    letterSpacing: "-0.025em",
                    color: "#1A2F1E",
                    margin: 0,
                  }}
                >
                  Two ways to{" "}
                  <span style={{ fontStyle: "italic", color: "rgba(26, 47, 30, 0.78)" }}>
                    stand watch.
                  </span>
                </h2>
              </div>
              {!isMobile && (
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 17,
                    lineHeight: 1.5,
                    color: "rgba(26, 47, 30, 0.6)",
                    margin: 0,
                    maxWidth: 320,
                    textAlign: "right",
                    paddingBottom: 4,
                  }}
                >
                  Free covers most permits. Pro is for the windows that close
                  in seconds.
                </p>
              )}
            </Reveal>

            {/* ───── Comparison table ─────
                Renders a calm skeleton while auth is restoring (so the
                CTA labels don't flash from "Begin free" → "Open app") or
                while a Stripe checkout redirect is in flight. The skeleton
                mirrors the real table's grid template + row count exactly,
                so the swap produces zero layout shift. */}
            {(authLoading || proLoading) ? (
              <motion.div
                key="pricing-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
                <PricingSkeleton isMobile={isMobile} />
              </motion.div>
            ) : (
            <motion.div
              key="pricing-table"
              role="table"
              aria-label="Plan comparison"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              style={{
                borderTop: "1px solid rgba(26, 47, 30, 0.22)",
              }}
            >
              {/* COLUMN HEADERS — plan + price */}
              <div
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1.2fr 1fr 1fr" : "1.6fr 1fr 1fr",
                  alignItems: "end",
                  gap: isMobile ? 12 : 24,
                  padding: isMobile ? "28px 0 24px" : "40px 0 32px",
                  borderBottom: "1px solid rgba(26, 47, 30, 0.22)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "rgba(26, 47, 30, 0.45)",
                  }}
                >
                  Capability
                </div>

                {/* Free column ─ Modern Ranger alignment:
                    The "tag slot" is a fixed-height row (24px) shared with the
                    Pro column's Recommended pill, so $0 and $9 land on the
                    SAME baseline at every breakpoint. The Free label itself
                    sits inside that slot, vertically centered. */}
                <div role="columnheader" style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 10,
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "rgba(26, 47, 30, 0.5)",
                        lineHeight: 1,
                      }}
                    >
                      Free
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 400,
                      fontSize: isMobile ? 32 : 44,
                      lineHeight: 1,
                      color: "#1A2F1E",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    $0
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: "rgba(26, 47, 30, 0.55)",
                      marginTop: 6,
                      lineHeight: 1,
                    }}
                  >
                    forever
                  </div>
                </div>

                {/* Pro column ─ Modern Ranger callout:
                    Pill in forest-green hairline + terracotta-orange dot.
                    Locked to the same 24px tag-slot height as Free so the
                    "Pro" label and "$9.99" price share an EXACT baseline
                    with "Free" / "$0" across mobile and desktop. */}
                <div
                  role="columnheader"
                  tabIndex={0}
                  aria-label="Pro plan, recommended"
                  className="pro-column"
                  style={{
                    textAlign: "center",
                    outline: "none",
                    borderRadius: 6,
                    // padding lets the focus ring sit a hair off the content
                    // without changing measured layout (compensated by negative margin)
                    padding: "4px 8px",
                    margin: "-4px -8px",
                    transition:
                      "box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div
                    style={{
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      className="pro-pill"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 9px 4px 8px",
                        border: "1px solid rgba(47, 111, 78, 0.35)",
                        borderRadius: 999,
                        background: "rgba(47, 111, 78, 0.06)",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        color: "#2F6F4E",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        // GPU-friendly transform target — no layout impact
                        transform: "translateZ(0)",
                        transition:
                          "background 240ms cubic-bezier(0.4, 0, 0.2, 1), border-color 240ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1), transform 260ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="pro-pill__dot"
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#C2603A",
                          flexShrink: 0,
                          // Subtle glow to echo the warm campfire-ember tone
                          boxShadow: "0 0 0 2px rgba(194, 96, 58, 0.12)",
                          transition:
                            "box-shadow 320ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                      Recommended
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "#2F6F4E",
                      marginBottom: 10,
                      lineHeight: 1,
                    }}
                  >
                    Pro
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 400,
                      fontSize: isMobile ? 32 : 44,
                      lineHeight: 1,
                      color: "#1A2F1E",
                      letterSpacing: "-0.02em",
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 3,
                    }}
                  >
                    <span>$9</span>
                    <span
                      style={{
                        fontStyle: "italic",
                        fontSize: isMobile ? 15 : 18,
                        color: "rgba(26, 47, 30, 0.5)",
                        transform: "translateY(-0.2em)",
                        letterSpacing: "0",
                      }}
                    >
                      .99
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: "rgba(26, 47, 30, 0.55)",
                      marginTop: 6,
                      lineHeight: 1,
                    }}
                  >
                    per month
                  </div>
                </div>
              </div>

              {/* Subtle hover/focus animations for the Pro column.
                  Uses transform + box-shadow only (zero layout impact).
                  Hovering the column also lifts the Recommended pill;
                  the column is keyboard-focusable for parity. */}
              <style>{`
                .pro-column { -webkit-tap-highlight-color: transparent; }
                .pro-column:hover .pro-pill,
                .pro-column:focus-visible .pro-pill {
                  background: rgba(47, 111, 78, 0.10);
                  border-color: rgba(47, 111, 78, 0.55);
                  transform: translateY(-1px);
                  box-shadow: 0 6px 18px -10px rgba(47, 111, 78, 0.45);
                }
                .pro-column:hover .pro-pill__dot,
                .pro-column:focus-visible .pro-pill__dot {
                  box-shadow: 0 0 0 3px rgba(194, 96, 58, 0.22);
                }
                .pro-pill:hover,
                .pro-pill:focus-visible {
                  background: rgba(47, 111, 78, 0.12) !important;
                  border-color: rgba(47, 111, 78, 0.6) !important;
                  transform: translateY(-1px);
                  box-shadow: 0 6px 18px -10px rgba(47, 111, 78, 0.5);
                }
                .pro-column:focus-visible {
                  box-shadow:
                    0 0 0 2px #FFFFFF,
                    0 0 0 4px rgba(47, 111, 78, 0.45);
                }
                @media (prefers-reduced-motion: reduce) {
                  .pro-column,
                  .pro-pill,
                  .pro-pill__dot {
                    transition: none !important;
                  }
                  .pro-column:hover .pro-pill,
                  .pro-column:focus-visible .pro-pill,
                  .pro-pill:hover,
                  .pro-pill:focus-visible {
                    transform: none !important;
                  }
                }
              `}</style>

              {/* CAPABILITY ROWS */}
              {[
                { label: "Permit trackers", free: "One", pro: "Unlimited", emphasize: true },
                { label: "Scan cadence", free: "Every 5 min", pro: "Every 2 min", emphasize: true },
                { label: "Email alerts", free: true as const, pro: true as const },
                { label: "SMS alerts", free: false as const, pro: true as const },
                { label: "Parks covered", free: "All 8", pro: "All 8" },
                { label: "Poko · AI park guide", free: true as const, pro: true as const },
                { label: "Cancel anytime", free: "—", pro: true as const },
              ].map((row, idx, arr) => (
                <motion.div
                  key={row.label}
                  role="row"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -6% 0px" }}
                  transition={{
                    duration: 0.6,
                    delay: idx * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1.2fr 1fr 1fr" : "1.6fr 1fr 1fr",
                    alignItems: "center",
                    gap: isMobile ? 12 : 24,
                    padding: isMobile ? "18px 0" : "22px 0",
                    borderBottom:
                      idx === arr.length - 1
                        ? "1px solid rgba(26, 47, 30, 0.22)"
                        : "1px solid rgba(26, 47, 30, 0.08)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: isMobile ? 17 : 19,
                      lineHeight: 1.3,
                      color: "#1A2F1E",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {row.label}
                  </div>

                  {/* Free cell */}
                  <PricingCell value={row.free} tone="muted" isMobile={isMobile} />

                  {/* Pro cell — emphasized rows render in gold serif */}
                  <PricingCell
                    value={row.pro}
                    tone={row.emphasize ? "highlight" : "default"}
                    isMobile={isMobile}
                  />
                </motion.div>
              ))}

              {/* CTA ROW */}
              <div
                role="group"
                aria-label="Choose a plan"
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1.2fr 1fr 1fr" : "1.6fr 1fr 1fr",
                  alignItems: "center",
                  gap: isMobile ? 12 : 24,
                  paddingTop: isMobile ? 28 : 36,
                }}
              >
                <div aria-hidden="true" />
                {/* Free CTA — centered within its column to align with $0 */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Link
                    to={ctaPath}
                    onClick={() => trackCta("landing_free_cta_clicked")}
                    className="pricing-cta pricing-cta--free"
                    aria-label={
                      ctaIntent === "signup"
                        ? "Begin free — create your WildAtlas account, no card required"
                        : "Open the WildAtlas app on your free plan"
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: isMobile ? 16 : 22,
                      color: "#1A2F1E",
                      textDecoration: "none",
                      paddingBottom: 6,
                      borderBottom: "1px solid rgba(26, 47, 30, 0.4)",
                      whiteSpace: "nowrap",
                      borderRadius: 4,
                      transition:
                        "border-color 240ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <span aria-hidden="true">Begin free</span>
                    <span
                      aria-hidden="true"
                      className="pricing-cta__arrow"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: isMobile ? 14 : 16,
                        display: "inline-block",
                        transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      →
                    </span>
                  </Link>
                </div>

                {/* Pro CTA — centered within its column to align with $9.99 */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      trackCta("landing_pro_cta_clicked");
                      handleProCheckout();
                    }}
                    disabled={proLoading}
                    aria-busy={proLoading}
                    aria-live="polite"
                    aria-label={(() => {
                      if (proLoading) return "Opening secure checkout, please wait";
                      if (ctaIntent === "manage")
                        return "Manage your Pro subscription — opens billing portal in a new tab";
                      if (ctaIntent === "signup")
                        return "Go Pro — sign in or create an account to upgrade for nine dollars and ninety-nine cents per month";
                      return "Upgrade to Pro for nine dollars and ninety-nine cents per month — opens secure checkout in a new tab";
                    })()}
                    className="pricing-cta pricing-cta--pro"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      paddingBottom: 6,
                      borderBottom: "1px solid #2F6F4E",
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: isMobile ? 16 : 22,
                      color: "#2F6F4E",
                      cursor: proLoading ? "not-allowed" : "pointer",
                      opacity: proLoading ? 0.6 : 1,
                      whiteSpace: "nowrap",
                      borderRadius: 4,
                      transition:
                        "color 240ms cubic-bezier(0.4, 0, 0.2, 1), border-color 240ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {proLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        <span aria-hidden="true">Opening…</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">{proCtaLabel}</span>
                        <span
                          aria-hidden="true"
                          className="pricing-cta__arrow"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: isMobile ? 14 : 16,
                            display: "inline-block",
                            transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                        >
                          →
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Polished press / hover / focus styles for the pricing CTAs.
                  Inline styles can't address pseudo-states, so we scope a
                  small style block here. Honors prefers-reduced-motion. */}
              <style>{`
                .pricing-cta {
                  outline: none;
                  -webkit-tap-highlight-color: transparent;
                }
                .pricing-cta:hover .pricing-cta__arrow {
                  transform: translateX(3px);
                }
                .pricing-cta:active:not(:disabled) {
                  transform: translateY(1px);
                }
                .pricing-cta--free:hover {
                  border-bottom-color: #1A2F1E !important;
                }
                .pricing-cta--pro:hover:not(:disabled) {
                  color: #1F4D35 !important;
                  border-bottom-color: #1F4D35 !important;
                }
                .pricing-cta:focus-visible {
                  box-shadow:
                    0 0 0 2px #F0EDEA,
                    0 0 0 4px rgba(47, 111, 78, 0.55);
                }
                .pricing-cta--free:focus-visible {
                  box-shadow:
                    0 0 0 2px #F0EDEA,
                    0 0 0 4px rgba(26, 47, 30, 0.55);
                }
                @media (prefers-reduced-motion: reduce) {
                  .pricing-cta,
                  .pricing-cta__arrow {
                    transition: none !important;
                  }
                  .pricing-cta:hover .pricing-cta__arrow,
                  .pricing-cta:active:not(:disabled) {
                    transform: none !important;
                  }
                }
              `}</style>
            </motion.div>
            )}

            {/* Footnote */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "rgba(26, 47, 30, 0.45)",
                margin: 0,
                marginTop: isMobile ? 32 : 48,
                textAlign: isMobile ? "left" : "right",
              }}
            >
              Both plans include Poko. Billed in USD; tax where applicable.
            </p>
          </div>
        </section>

        {/* Editorial coda removed — single pull-quote above the park list carries the voice. */}


        {/* ═══════════════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════════════ */}
        <footer
          style={{
            background: "#F0EDEA",
            borderTop: "1px solid rgba(26, 47, 30, 0.18)",
            paddingTop: isMobile ? 56 : 88,
            paddingBottom: isMobile ? 48 : 64,
            paddingLeft: isMobile ? 20 : isNarrow ? 32 : 56,
            paddingRight: isMobile ? 20 : isNarrow ? 32 : 56,
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Top row — masthead + three balanced link groups.
                Grid ratio gives masthead breathing room (1.6fr) while the
                three trailing columns share equal width — so "Navigate",
                "Resources", and "Colophon" labels sit on a single optical axis. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : isNarrow
                    ? "1fr 1fr"
                    : "1.6fr 1fr 1fr 1.2fr",
                gap: isMobile ? 36 : isNarrow ? 40 : 48,
                marginBottom: isMobile ? 40 : 64,
              }}
            >
              {/* ───── Masthead ───── */}
              <div style={{ gridColumn: isNarrow && !isMobile ? "span 2" : "auto" }}>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 32 : 44,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: "#1A2F1E",
                    letterSpacing: "-0.02em",
                    marginBottom: 12,
                  }}
                >
                  WildAtlas
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.5)",
                    marginBottom: 20,
                  }}
                >
                  Field Notes · Vol. 01 · Spring MMXXVI
                </div>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "rgba(26, 47, 30, 0.65)",
                    margin: 0,
                    maxWidth: 360,
                  }}
                >
                  An independent watch on Recreation.gov — kept for travellers
                  who'd rather sleep than refresh.
                </p>
              </div>

              {/* ───── Navigate ───── */}
              <div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.5)",
                    marginBottom: 18,
                  }}
                >
                  Navigate
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {[
                    { href: "#how-it-works", label: "The Method" },
                    { href: "#pricing", label: "Pricing" },
                  ].map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 17,
                          lineHeight: 1.3,
                          color: "#1A2F1E",
                          textDecoration: "none",
                          transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#2F6F4E")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                  <li>
                    <Link
                      to={ctaPath}
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontStyle: "italic",
                        fontSize: 17,
                        lineHeight: 1.3,
                        color: "#2F6F4E",
                        textDecoration: "none",
                        transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#1F4D35")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#2F6F4E")}
                    >
                      Begin watching →
                    </Link>
                  </li>
                </ul>
              </div>

              {/* ───── Resources ───── */}
              <div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.5)",
                    marginBottom: 18,
                  }}
                >
                  Resources
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {[
                    { to: "/privacy", label: "Privacy" },
                    { to: "/terms", label: "Terms of Use" },
                  ].map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 17,
                          lineHeight: 1.3,
                          color: "#1A2F1E",
                          textDecoration: "none",
                          transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#2F6F4E")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <a
                      href="mailto:hello@wildatlas.app"
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 17,
                        lineHeight: 1.3,
                        color: "#1A2F1E",
                        textDecoration: "none",
                        transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#2F6F4E")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>

              {/* ───── Colophon ───── */}
              <div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.5)",
                    marginBottom: 18,
                  }}
                >
                  Colophon
                </div>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: "rgba(26, 47, 30, 0.7)",
                    margin: 0,
                  }}
                >
                  Set in{" "}
                  <span style={{ fontStyle: "italic" }}>Cormorant Garamond</span>{" "}
                  and DM Sans.
                  <br />
                  Composed in cream{" "}
                  <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                    #F0EDEA
                  </span>{" "}
                  on forest{" "}
                  <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                    #1A2F1E
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Hairline rule */}
            <div
              aria-hidden="true"
              style={{
                height: 1,
                background: "rgba(26, 47, 30, 0.14)",
                marginBottom: isMobile ? 20 : 28,
              }}
            />

            {/* Bottom row — independence note + © meta only.
                Privacy/Terms now live in Resources so this strip stays calm. */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "rgba(26, 47, 30, 0.5)",
                  margin: 0,
                  maxWidth: 540,
                  letterSpacing: "0.01em",
                }}
              >
                An independent service. Not affiliated with Recreation.gov, the
                National Park Service, or any government agency.
              </p>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.5)",
                }}
              >
                © MMXXVI · WildAtlas
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
