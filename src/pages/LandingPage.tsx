import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import posthog from "@/lib/posthog";
import halfDomeNight from "@/assets/landing-halfdome-night.jpg";
import { PARK_COLORS } from "@/lib/parks";
import { useProCtaIntent } from "@/hooks/useProCtaIntent";
import { useFleetActivity, formatRecency, recencyStyle } from "@/hooks/useFleetActivity";
import WatchOhOne from "@/components/landing/WatchOhOne";

// Park list for the landing strip — order intentional (signature parks first).
const LANDING_PARKS: Array<{ id: string; label: string; color: string }> = [
  { id: "yosemite",       label: "YOSEMITE",       color: PARK_COLORS.yosemite },
  { id: "zion",           label: "ZION",           color: PARK_COLORS.zion },
  { id: "glacier",        label: "GLACIER",        color: PARK_COLORS.glacier },
  { id: "grand_canyon",   label: "GRAND CANYON",   color: PARK_COLORS.grand_canyon },
  { id: "grand_teton",    label: "GRAND TETON",    color: PARK_COLORS.grand_teton },
  { id: "arches",         label: "ARCHES",         color: PARK_COLORS.arches },
  { id: "rocky_mountain", label: "ROCKY MOUNTAIN", color: PARK_COLORS.rocky_mountain },
  { id: "rainier",        label: "RAINIER",        color: PARK_COLORS.rainier },
];
const LANDING_PARK_IDS = LANDING_PARKS.map((p) => p.id);




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
  caption,
}: {
  value: string | boolean;
  tone: "default" | "muted" | "highlight";
  isMobile: boolean;
  caption?: string;
}) => {
  const baseColor =
    tone === "highlight"
      ? "#2F6F4E"
      : tone === "muted"
        ? "rgba(26, 47, 30, 0.7)"
        : "#1A2F1E";

  // Optional italic caption rendered directly beneath any cell value.
  const captionEl = caption ? (
    <div
      style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: "italic",
        fontSize: 13,
        lineHeight: 1.3,
        color: "#5F6E58",
        textAlign: "center",
        marginTop: 4,
      }}
    >
      {caption}
    </div>
  ) : null;

  if (value === true) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          aria-label="Included"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: isMobile ? 16 : 18,
            color: baseColor,
            lineHeight: 1,
          }}
        >
          ✓
        </div>
        {captionEl}
      </div>
    );
  }
  if (value === false) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          aria-label="Not included"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: isMobile ? 18 : 20,
            color: "rgba(26, 47, 30, 0.25)",
            lineHeight: 1,
          }}
        >
          —
        </div>
        {captionEl}
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: tone === "highlight" ? "italic" : "normal",
          fontSize: isMobile ? 16 : 19,
          lineHeight: 1.2,
          color: baseColor,
          letterSpacing: "-0.005em",
        }}
      >
        {value}
      </div>
      {captionEl}
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

const LandingPage = () => {
  const { user } = useAuth();
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

  // Single source of truth for Pro CTA copy + destination.
  // The intent is persisted across auth restore and Stripe round-trips so the
  // label and href stay stable instead of flickering during reconciliation.
  const proCta = useProCtaIntent();
  const ctaPath = user ? "/app" : "/auth?signup=true";

  // Live fleet recency — drives per-park underline weight + caption and the
  // global "Last alert" eyebrow timestamp.
  const fleet = useFleetActivity(LANDING_PARK_IDS);

  const trackCta = (event: string) => {
    try {
      posthog.capture(event, {
        source: "landing_page",
        variant: "editorial_redesign_2026_04",
        device: isMobile ? "mobile" : "desktop",
        cta_intent: proCta.intent,
      });
    } catch {
      // Never block navigation on analytics failure
    }
  };

  /**
   * Dispatches the Pro CTA based on the resolved intent. The intent owns
   * routing — this handler only knows how to execute the three destination
   * kinds (`navigate`, `checkout`, `portal`).
   */
  const handleProCheckout = async () => {
    const { destination, intent } = proCta;

    if (destination.kind === "navigate") {
      navigate(destination.path);
      return;
    }

    setProLoading(true);
    try {
      const fnName = destination.kind === "portal" ? "customer-portal" : "create-checkout";
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      if (data?.error === "already_subscribed") {
        toast({ title: "Already subscribed!", description: "You're already a Pro member." });
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error(`No ${destination.kind} URL returned`);
      }
    } catch (e: unknown) {
      console.error(`${intent} flow error:`, e);
      const description =
        destination.kind === "portal"
          ? "Couldn't open the billing portal. Please try again!"
          : "Couldn't start checkout. Please try again!";
      toast({ title: "Trail hiccup", description });
    } finally {
      setProLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // "View Pro" affordance
  // ──────────────────────────────────────────────────────────────────────
  // Lets users jump from anywhere on the page to the Pro column in the
  // pricing table. Smooth-scrolls the column into view and plays a brief
  // Hero Green ring + soft wash so sighted users can find it. The highlight
  // is purely decorative — assistive tech receives focus on the column
  // header instead, so the cue isn't audible noise.
  const proColumnRef = useRef<HTMLDivElement | null>(null);
  const [proHighlight, setProHighlight] = useState(false);
  const proHighlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (proHighlightTimerRef.current !== null) {
        window.clearTimeout(proHighlightTimerRef.current);
      }
    };
  }, []);

  const handleViewPro = () => {
    trackCta("landing_view_pro_clicked");
    const node = proColumnRef.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    node.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });

    // Move keyboard focus to the column header so screen-reader users land
    // in the same place sighted users are looking.
    if (typeof node.focus === "function") {
      node.focus({ preventScroll: true });
    }

    // Replay the highlight on every click — clear any in-flight timer first
    // so rapid presses always restart the animation cleanly.
    if (proHighlightTimerRef.current !== null) {
      window.clearTimeout(proHighlightTimerRef.current);
    }
    setProHighlight(false);
    // Next frame: re-add the class so the keyframe restarts.
    requestAnimationFrame(() => {
      setProHighlight(true);
      proHighlightTimerRef.current = window.setTimeout(() => {
        setProHighlight(false);
        proHighlightTimerRef.current = null;
      }, 1800);
    });
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
                  <button
                    type="button"
                    onClick={handleViewPro}
                    aria-label="View Pro plan in pricing"
                    aria-controls="pricing"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(47, 111, 78, 0.35)",
                      borderRadius: 999,
                      padding: "5px 12px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "#2F6F4E",
                      cursor: "pointer",
                      transition:
                        "color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#1F4D35";
                      e.currentTarget.style.borderColor = "#1F4D35";
                      e.currentTarget.style.backgroundColor = "rgba(47, 111, 78, 0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#2F6F4E";
                      e.currentTarget.style.borderColor = "rgba(47, 111, 78, 0.35)";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    View Pro
                  </button>
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
                <span>Start the watch</span>
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
              {/* Top-left intentionally blank — eyebrow scaffolding removed */}
              <div aria-hidden="true" />

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
                {/* Permit name — serif, primary */}
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: 1.2,
                    color: "#F0EDEA",
                    margin: 0,
                  }}
                >
                  Half Dome cables
                </p>
                {/* Date + spots — italic serif, amber */}
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 17,
                    lineHeight: 1.3,
                    color: "#C9A96E",
                    margin: 0,
                    marginTop: 4,
                  }}
                >
                  Jul 14 · 2 spots opened
                </p>
                {/* Urgency — DM Sans, sage */}
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    lineHeight: 1.4,
                    color: "#A8BDAC",
                    margin: 0,
                    marginTop: 10,
                  }}
                >
                  Window closes in ~4 min
                </p>
                {/* Link — DM Sans, underlined */}
                <a
                  href="https://www.recreation.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "#A8BDAC",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                    margin: 0,
                    marginTop: 8,
                  }}
                >
                  rec.gov/r/permitYOSE →
                </a>
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
                  <span>Start the watch</span>
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

                {/* Restrained meta — two lines, muted caps */}
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(26, 47, 30, 0.42)",
                    margin: 0,
                    marginTop: 18,
                    lineHeight: 1.7,
                  }}
                >
                  Free to begin · No card
                  <br />
                  SMS alerts · Pro · $9.99/mo
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

        {/* SECTION 2.5 (Half Dome plate) and SECTION 3A (pull-quote) removed:
            beautiful but broke conversion momentum between the hero and The
            Fleet. ParallaxPhoto + halfDomeNight asset preserved for a future
            About page. */}

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
                {/* § 02 · The Fleet eyebrow removed — headline stands alone */}
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
              {/* Live eyebrow — global last-alert timestamp from recent_finds */}
              <span
                aria-live="polite"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.55)",
                  fontVariantNumeric: "tabular-nums",
                  paddingBottom: 4,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#2F6F4E",
                    boxShadow: "0 0 0 3px rgba(47, 111, 78, 0.18)",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(26, 47, 30, 0.75)" }}>Live</span>
                <span style={{ color: "rgba(26, 47, 30, 0.35)" }}>·</span>
                <span>{LANDING_PARKS.length} Parks</span>
                <span style={{ color: "rgba(26, 47, 30, 0.35)" }}>·</span>
                <span style={{ textTransform: "none", letterSpacing: "0.06em" }}>
                  {fleet.loading
                    ? "Loading…"
                    : fleet.globalLastAlertAt
                      ? `Last alert ${formatRecency(fleet.globalLastAlertAt).replace(/^ALERTED\s+/, "").replace(/\s+AGO$/, "").toLowerCase()} ago`
                      : "Standing by"}
                </span>
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
              {LANDING_PARKS.map((park, idx) => {
                const lastAlertAt = fleet.byPark[park.id]?.lastAlertAt ?? null;
                const recency = recencyStyle(lastAlertAt);
                const caption = formatRecency(lastAlertAt);
                return (
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
                      gap: 8,
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
                    {/* Recency-weighted underline. Dashed variant uses a top
                        border on a transparent row so dashes render cleanly. */}
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
                        height: recency.height,
                        opacity: recency.opacity,
                        transformOrigin: "left center",
                        ...(recency.borderStyle === "dashed"
                          ? {
                              background: "transparent",
                              borderTop: `${recency.height}px dashed ${park.color}`,
                            }
                          : { background: park.color }),
                      }}
                    />
                    {/* Live recency caption */}
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#7A7A74",
                        fontVariantNumeric: "tabular-nums",
                        marginTop: 2,
                      }}
                    >
                      {fleet.loading ? "—" : caption}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
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
            SECTION 4 — THE METHOD (consolidated, single screen)
            Three plain-numbered steps, stacked vertically. No
            Roman numerals, no eyebrow chrome. Body copy locked to
            #C9D4CC for WCAG AA contrast against #1A2F1E (≈9:1).
            ═══════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          style={{
            background: "#1A2F1E",
            color: "#F0EDEA",
            paddingTop: isMobile ? 56 : 96,
            paddingBottom: isMobile ? 56 : 96,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
            position: "relative",
          }}
        >
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            {/* ───── Section headline (kept) ───── */}
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isMobile ? 38 : isNarrow ? 60 : 80,
                lineHeight: isMobile ? 1.04 : 0.98,
                letterSpacing: isMobile ? "-0.02em" : "-0.03em",
                color: "#F0EDEA",
                margin: 0,
                marginBottom: isMobile ? 48 : 88,
                maxWidth: 820,
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
              <span style={{ fontStyle: "italic", color: "#C9D4CC" }}>
                in the quiet hours.
              </span>
            </h2>

            {/* ───── Steps list ─────
                Single rhythm: amber 01/02/03, serif heading, sans body.
                Step 02 carries the analog clock at 2:14 alongside the body.
                Hairline rule between steps preserves editorial cadence. */}
            {[
              {
                num: "01",
                heading: "Name the permit you want.",
                body: "Park, permit, dates. One minute, start to finish.",
                clock: false,
              },
              {
                num: "02",
                heading: "Poko watches while the park sleeps.",
                body:
                  "Recreation.gov swept every two minutes. The heaviest drops arrive between 10 p.m. and 6 a.m.",
                clock: true,
              },
              {
                num: "03",
                heading: "The text arrives. Four minutes to move.",
                body:
                  "Tap the link. Book it on Recreation.gov before the next refresh.",
                clock: false,
              },
            ].map((step, idx) => (
              <motion.article
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
                style={{
                  paddingTop: isMobile ? 28 : 36,
                  paddingBottom: isMobile ? 28 : 36,
                  borderTop: "1px solid rgba(240, 237, 234, 0.14)",
                  borderBottom:
                    idx === 2 ? "1px solid rgba(240, 237, 234, 0.14)" : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    color: "#C9A96E",
                    marginBottom: isMobile ? 12 : 14,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {step.num}
                </div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 22 : 28,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    letterSpacing: "-0.015em",
                    color: "#F0EDEA",
                    margin: 0,
                    marginBottom: isMobile ? 10 : 12,
                  }}
                >
                  {step.heading}
                </h3>

                {step.clock ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        isMobile || isNarrow ? "1fr" : "1fr 168px",
                      gap: isMobile ? 24 : 40,
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15,
                        lineHeight: 1.65,
                        color: "#C9D4CC",
                        margin: 0,
                        maxWidth: 560,
                      }}
                    >
                      {step.body}
                    </p>
                    {/* Inline clock at 2:14 */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: isMobile ? "flex-start" : "center",
                        alignItems: "center",
                      }}
                      aria-hidden="true"
                    >
                      <svg
                        width={isMobile ? 120 : 160}
                        height={isMobile ? 120 : 160}
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
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: "#C9D4CC",
                      margin: 0,
                      maxWidth: 620,
                    }}
                  >
                    {step.body}
                  </p>
                )}
              </motion.article>
            ))}
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
            SECTION 4.25 — WATCH #001 (Field Notes inaugural)
            Live ticker pulled from recent_finds via the
            get_recent_finds_ticker RPC. 60s client cache.
            ═══════════════════════════════════════════════════ */}
        <WatchOhOne isMobile={isMobile} />

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
                {/* Eyebrow removed — was misleading scaffolding ("§ 04 · Terms of Use"). */}
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

            {/* ───── Comparison table ───── */}
            <div
              role="table"
              aria-label="Plan comparison"
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

                {/* Free column */}
                <div role="columnheader" style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "rgba(26, 47, 30, 0.5)",
                      marginBottom: 10,
                      // Reserves the same vertical slot as the Pro "Recommended" tag,
                      // so $0 and $9 sit on the same baseline across columns.
                      paddingTop: 18,
                    }}
                  >
                    Free
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

                {/* Pro column */}
                <div
                  ref={proColumnRef}
                  role="columnheader"
                  tabIndex={-1}
                  onClick={handleViewPro}
                  className={`pro-column-press${proHighlight ? " pro-column-highlight" : ""}`}
                  style={{
                    textAlign: "center",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {/* Subtle Pro callout — keeps the table calm but anchors the recommendation. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewPro();
                    }}
                    aria-label="View Pro plan in pricing"
                    aria-controls="pricing"
                    className="pro-pill-press"
                    style={{
                      display: "inline-block",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 9,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "rgba(47, 111, 78, 0.7)",
                      marginBottom: 6,
                      lineHeight: 1,
                    }}
                  >
                    Recommended
                  </button>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "#2F6F4E",
                      marginBottom: 10,
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

              {/* CAPABILITY ROWS */}
              {([
                { label: "Permit trackers", free: "One", pro: "Unlimited", emphasize: true },
                {
                  label: "Scan cadence",
                  free: "Every 5 min",
                  pro: "Every 2 min",
                  emphasize: true,
                  proCaption: "matches the refresh",
                },
                { label: "Email alerts", free: true as const, pro: true as const },
                { label: "SMS alerts", free: false as const, pro: true as const },
                { label: "Parks covered", free: "All 8", pro: "All 8" },
                { label: "Poko · AI park guide", free: true as const, pro: true as const },
                { label: "Priority queue at peak hours", free: "—", pro: true as const },
                { label: "Cancel whenever", free: "—", pro: true as const },
              ] as Array<{
                label: string;
                free: string | boolean;
                pro: string | boolean;
                emphasize?: boolean;
                proCaption?: string;
              }>).map((row, idx, arr) => (
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
                    caption={row.proCaption}
                  />
                </motion.div>
              ))}

              {/* CTA ROW */}
              <div
                role="row"
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
                    className="landing-pricing-cta"
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
                      transition: "border-color 240ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#1A2F1E")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "rgba(26, 47, 30, 0.4)")
                    }
                  >
                    <span>Start free</span>
                    <span
                      aria-hidden="true"
                      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: isMobile ? 14 : 16 }}
                    >
                      →
                    </span>
                  </Link>
                </div>

                {/* Pro CTA — centered within its column to align with $9.99 */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => {
                      trackCta("landing_pro_cta_clicked");
                      handleProCheckout();
                    }}
                    disabled={proLoading}
                    className="landing-pricing-cta"
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
                      transition: "color 240ms cubic-bezier(0.4, 0, 0.2, 1), border-color 240ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#1F4D35";
                      e.currentTarget.style.borderColor = "#1F4D35";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#2F6F4E";
                      e.currentTarget.style.borderColor = "#2F6F4E";
                    }}
                  >
                    {proLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>{proCta.copy.loadingLabel}</span>
                      </>
                    ) : (
                      <>
                        <span>Start Pro</span>
                        <span
                          aria-hidden="true"
                          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: isMobile ? 14 : 16 }}
                        >
                          →
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 5 — CLOSING BEAT
            Forest green full-bleed, bleeds into cream footer
            (no divider) for visual rhythm.
            ═══════════════════════════════════════════════════ */}
        <section
          aria-label="Final call to action"
          style={{
            background: "#1A2F1E",
            paddingTop: isMobile ? 72 : 112,
            paddingBottom: isMobile ? 72 : 112,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: 32,
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
                color: "#F0EDEA",
                margin: 0,
              }}
            >
              The next drop is tonight.
            </h2>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 20,
                lineHeight: 1.4,
                color: "#A8BDAC",
                margin: "12px 0 0",
              }}
            >
              You can be awake for it. Or you can sleep.
            </p>

            {/* CTA pair — stacked on mobile, side-by-side on desktop */}
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "center",
                alignItems: "center",
                gap: isMobile ? 12 : 16,
                marginTop: isMobile ? 32 : 40,
              }}
            >
              <Link
                to={ctaPath}
                onClick={() => trackCta("landing_closing_free_cta_clicked")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#2F6F4E",
                  color: "#F0EDEA",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "14px 24px",
                  borderRadius: 8,
                  textDecoration: "none",
                  border: "none",
                  whiteSpace: "nowrap",
                  minWidth: isMobile ? 240 : "auto",
                  transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1F4D35")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2F6F4E")}
              >
                Start the watch — free
              </Link>
              <button
                onClick={() => {
                  trackCta("landing_closing_pro_cta_clicked");
                  handleProCheckout();
                }}
                disabled={proLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  color: "#F0EDEA",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "14px 24px",
                  borderRadius: 8,
                  border: "0.5px solid #F0EDEA",
                  cursor: proLoading ? "not-allowed" : "pointer",
                  opacity: proLoading ? 0.6 : 1,
                  whiteSpace: "nowrap",
                  minWidth: isMobile ? 240 : "auto",
                  transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(240, 237, 234, 0.06)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {proLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} />
                    <span>{proCta.copy.loadingLabel}</span>
                  </>
                ) : (
                  <span>See Pro ($9.99)</span>
                )}
              </button>
            </div>

            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: "#A8BDAC",
                margin: "20px 0 0",
                lineHeight: 1.5,
              }}
            >
              No card required for free · Cancel Pro anytime
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
                {/* Field Notes · Vol. 01 line removed — already present in the hero. */}
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "rgba(26, 47, 30, 0.65)",
                    margin: 0,
                    marginTop: 4,
                    maxWidth: 360,
                  }}
                >
                  An independent watch on Recreation.gov — kept for travelers
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
                      Start the watch →
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
              <div style={{ maxWidth: 540 }}>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: "rgba(26, 47, 30, 0.5)",
                    margin: 0,
                    letterSpacing: "0.01em",
                  }}
                >
                  An independent service. Not affiliated with Recreation.gov, the
                  National Park Service, or any government agency.
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: "rgba(26, 47, 30, 0.5)",
                    margin: "6px 0 0",
                    letterSpacing: "0.01em",
                  }}
                >
                  Questions?{" "}
                  <a
                    href="mailto:hello@wildatlas.app"
                    style={{
                      color: "rgba(26, 47, 30, 0.7)",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(26, 47, 30, 0.25)",
                      transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1A2F1E")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(26, 47, 30, 0.7)")
                    }
                  >
                    hello@wildatlas.app
                  </a>
                </p>
              </div>
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
