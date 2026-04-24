import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import posthog from "@/lib/posthog";
import halfDomeNight from "@/assets/landing-halfdome-night.jpg";
import { PARK_COLORS } from "@/lib/parks";

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
      }}
    >
      {value}
    </div>
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

  const ctaPath = user ? "/app" : "/auth?signup=true";

  const trackCta = (event: string) => {
    try {
      posthog.capture(event, {
        source: "landing_page",
        variant: "editorial_redesign_2026_04",
        device: isMobile ? "mobile" : "desktop",
      });
    } catch {
      // Never block navigation on analytics failure
    }
  };


  const handleProCheckout = async () => {
    if (!user) {
      navigate("/auth?signup=true");
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
        {/* ── Nav ── */}
        <nav
          className="sticky top-0 z-50"
          style={{
            background: "#F0EDEA",
            borderBottom: "0.5px solid rgba(26, 47, 30, 0.1)",
          }}
        >
          <div
            className="mx-auto h-16 flex items-center justify-between"
            style={{ maxWidth: 680, padding: isMobile ? "0 20px" : "0 24px" }}
          >
            <Link
              to="/"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22,
                fontWeight: 500,
                color: "#1A2F1E",
                letterSpacing: "0.01em",
                textDecoration: "none",
              }}
            >
              WildAtlas
            </Link>

            <div className="flex items-center" style={{ gap: isMobile ? 16 : 24 }}>
              {!isNarrow && (
                <>
                  <a
                    href="#how-it-works"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.7)",
                      textDecoration: "none",
                    }}
                  >
                    How it works
                  </a>
                  <a
                    href="#pricing"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.7)",
                      textDecoration: "none",
                    }}
                  >
                    Pricing
                  </a>
                </>
              )}
              <Link
                to="/auth?signup=true"
                onClick={() => trackCta("landing_nav_start_clicked")}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#2F6F4E",
                  textDecoration: "underline",
                  textDecorationColor: "#2F6F4E",
                  textUnderlineOffset: 4,
                  whiteSpace: "nowrap",
                }}
              >
                Start watching →
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
                  The permit
                  <br />
                  appears at{" "}
                  <span
                    style={{
                      fontStyle: "italic",
                      color: "rgba(26, 47, 30, 0.78)",
                    }}
                  >
                    2:14am.
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
                  You're asleep. Your phone isn't.
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
                    "Cancellations don't post on a schedule. We watch the door
                    so you don't have to."
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
                    2 spots just opened
                  </span>{" "}
                  for July 14. Book before the window closes.
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
                  Free to begin · No card required
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
        <section
          style={{
            position: "relative",
            width: "100%",
            height: isNarrow ? 420 : 560,
            overflow: "hidden",
            background: "#0B1A22",
          }}
        >
          <img
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
            }}
          />
          {/* Universal 5-stop scrim — top fade into hero cream, bottom fade to deep */}
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
          {/* Overlay caption — italic, bottom-anchored, restrained */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: isNarrow ? 32 : 48,
              padding: isNarrow ? "0 24px" : "0 32px",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "rgba(240, 237, 234, 0.6)",
                margin: 0,
                marginBottom: 14,
              }}
            >
              — 37.7459° N · 119.5332° W · 02:14 PST
            </p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: isNarrow ? 20 : 26,
                lineHeight: 1.35,
                color: "#F0EDEA",
                margin: 0,
                WebkitFontSmoothing: "antialiased",
                textShadow: "0 1px 24px rgba(0,0,0,0.4)",
              }}
            >
              Half Dome. The hour the permits return.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3A — EDITORIAL PULL-QUOTE
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            maxWidth: 520,
            margin: "0 auto",
            paddingTop: isNarrow ? 56 : 80,
            paddingBottom: isNarrow ? 40 : 64,
            paddingLeft: isNarrow ? 20 : 24,
            paddingRight: isNarrow ? 20 : 24,
            background: "#F0EDEA",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontWeight: isNarrow ? 500 : 400,
              fontSize: isNarrow ? 24 : 32,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              color: "#1A2F1E",
              margin: 0,
              WebkitFontSmoothing: "antialiased",
            }}
          >
            Permits return at 2am. That's our shift.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3B — PARK LIST BAND
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            maxWidth: 680,
            margin: "0 auto",
            paddingTop: 12,
            paddingBottom: 80,
            paddingLeft: 20,
            paddingRight: 20,
            background: "#F0EDEA",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              columnGap: isNarrow ? 14 : 22,
              rowGap: isNarrow ? 14 : 18,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: isNarrow ? 10 : 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: isNarrow ? "0.1em" : "0.15em",
            }}
            aria-label="Parks currently watched by WildAtlas"
          >
            {LANDING_PARKS.map((park) => (
              <span
                key={park.label}
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  color: "rgba(26, 47, 30, 0.55)",
                }}
              >
                <span>{park.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    width: "100%",
                    minWidth: 24,
                    height: 2,
                    background: park.color,
                    borderRadius: 1,
                    opacity: 0.9,
                  }}
                />
              </span>
            ))}
          </div>
        </section>

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
            paddingTop: isMobile ? 80 : 128,
            paddingBottom: isMobile ? 80 : 128,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
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
                marginBottom: isMobile ? 56 : 96,
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

            {/* ───── Section headline ───── */}
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isMobile ? 44 : isNarrow ? 64 : 88,
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                color: "#F0EDEA",
                margin: 0,
                marginBottom: isMobile ? 64 : 112,
                maxWidth: 880,
              }}
            >
              Three movements.{" "}
              <span style={{ fontStyle: "italic", color: "#A8C4B8" }}>
                One alert.
              </span>
              <br />
              Everything else,{" "}
              <span style={{ fontStyle: "italic", color: "rgba(240, 237, 234, 0.55)" }}>
                while you sleep.
              </span>
            </h2>

            {/* ════════════════════════════════════════
                STEP I — Wide left numeral, narrow text
                ════════════════════════════════════════ */}
            <article
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
                  Tell Poko which permit you want.
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
                  Pick the park, the permit, the dates. About a minute. That's
                  the last thing you do.
                </p>
              </div>
            </article>

            {/* ════════════════════════════════════════
                STEP II — Inline clock ornament
                Asymmetric: text on the left, clock on the right
                ════════════════════════════════════════ */}
            <article
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
                  Recreation.gov gets scanned every two minutes. Cancellations
                  drop hardest between{" "}
                  <span style={{ color: "#C9A96E", fontStyle: "italic" }}>
                    10pm and 6am.
                  </span>{" "}
                  We're there.
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
            </article>

            {/* ════════════════════════════════════════
                STEP III — Typography-led with marginalia timer
                ════════════════════════════════════════ */}
            <article
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
                    You have four minutes.
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
                  We send the link. You book fast. The permit's yours if you're
                  faster than the next person refreshing Recreation.gov.
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
            </article>
          </div>
        </section>

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
            paddingTop: isMobile ? 80 : 128,
            paddingBottom: isMobile ? 64 : 96,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
          }}
        >
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            {/* ───── Section masthead ───── */}
            <div
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
                    keep watch.
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
                  Free is enough for most wilderness permits. Pro is for the
                  windows that close in seconds.
                </p>
              )}
            </div>

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
                  gridTemplateColumns: isMobile ? "1.4fr 1fr 1fr" : "1.6fr 1fr 1fr",
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
                <div role="columnheader">
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "rgba(26, 47, 30, 0.5)",
                      marginBottom: 10,
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
                      marginTop: 4,
                    }}
                  >
                    forever
                  </div>
                </div>

                {/* Pro column */}
                <div role="columnheader">
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
                      gap: 6,
                    }}
                  >
                    <span>$9</span>
                    <span
                      style={{
                        fontStyle: "italic",
                        fontSize: isMobile ? 18 : 22,
                        color: "rgba(26, 47, 30, 0.55)",
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
                      marginTop: 4,
                    }}
                  >
                    per month
                  </div>
                </div>
              </div>

              {/* CAPABILITY ROWS */}
              {[
                { label: "Permit trackers", free: "One", pro: "Unlimited", emphasize: true },
                { label: "Scan cadence", free: "Every 5 min", pro: "Every 2 min", emphasize: true },
                { label: "Email alerts", free: true as const, pro: true as const },
                { label: "SMS alerts", free: false as const, pro: true as const },
                { label: "Parks covered", free: "All 8", pro: "All 8" },
                { label: "Poko · AI park guide", free: true as const, pro: true as const },
                { label: "Cancel whenever", free: "—", pro: true as const },
              ].map((row, idx, arr) => (
                <div
                  key={row.label}
                  role="row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1.4fr 1fr 1fr" : "1.6fr 1fr 1fr",
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
                </div>
              ))}

              {/* CTA ROW */}
              <div
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1.4fr 1fr 1fr" : "1.6fr 1fr 1fr",
                  alignItems: "center",
                  gap: isMobile ? 12 : 24,
                  paddingTop: isMobile ? 28 : 36,
                }}
              >
                <div aria-hidden="true" />
                {/* Free CTA */}
                <Link
                  to={ctaPath}
                  onClick={() => trackCta("landing_free_cta_clicked")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: isMobile ? 18 : 22,
                    color: "#1A2F1E",
                    textDecoration: "none",
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(26, 47, 30, 0.4)",
                    width: "fit-content",
                    transition: "border-color 240ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "#1A2F1E")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(26, 47, 30, 0.4)")
                  }
                >
                  <span>Begin free</span>
                  <span
                    aria-hidden="true"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                  >
                    →
                  </span>
                </Link>

                {/* Pro CTA */}
                <button
                  onClick={() => {
                    trackCta("landing_pro_cta_clicked");
                    handleProCheckout();
                  }}
                  disabled={proLoading}
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
                    fontSize: isMobile ? 18 : 22,
                    color: "#2F6F4E",
                    cursor: proLoading ? "not-allowed" : "pointer",
                    opacity: proLoading ? 0.6 : 1,
                    width: "fit-content",
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
                      <span>Opening…</span>
                    </>
                  ) : (
                    <>
                      <span>Upgrade to Pro</span>
                      <span
                        aria-hidden="true"
                        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                      >
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

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
              Both plans include Poko, our AI park guide. No card required to begin.
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
            borderTop: "0.5px solid rgba(26, 47, 30, 0.1)",
            paddingTop: 40,
            paddingBottom: 80,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 13,
                lineHeight: 1.6,
                color: "rgba(26, 47, 30, 0.5)",
                margin: 0,
                marginBottom: 24,
              }}
            >
              WildAtlas is an independent service. Not affiliated with Recreation.gov, the National Park Service, or any government agency.
            </p>

            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                fontWeight: 500,
                color: "#1A2F1E",
                marginBottom: 12,
              }}
            >
              WildAtlas
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 20,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "rgba(26, 47, 30, 0.5)",
              }}
            >
              <Link
                to="/privacy"
                style={{ color: "rgba(26, 47, 30, 0.5)", textDecoration: "none" }}
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                style={{ color: "rgba(26, 47, 30, 0.5)", textDecoration: "none" }}
              >
                Terms
              </Link>
              <span>© 2026</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
