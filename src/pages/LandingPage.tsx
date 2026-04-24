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




const scrollReveal = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  }),
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
            SECTION 1 — HERO
            ═══════════════════════════════════════════════════ */}
        <section ref={heroRef} style={{ background: "#F0EDEA" }}>
          <div
            className="mx-auto"
            style={{
              maxWidth: 680,
              padding: isMobile ? "60px 20px 80px" : "80px 24px 96px",
              textAlign: "center",
            }}
          >
            {/* Headline */}
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isMobile ? 44 : 68,
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                color: "#1A2F1E",
                margin: 0,
              }}
            >
              The permit
              <br />
              appears at 2:14am.
            </h1>

            {/* Subhead */}
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: isMobile ? 22 : 26,
                lineHeight: 1.3,
                color: "rgba(26, 47, 30, 0.65)",
                margin: 0,
                marginTop: 20,
              }}
            >
              You're asleep. Your phone isn't.
            </p>

            {/* SMS bubble */}
            <div
              style={{
                background: "#1A2F1E",
                borderRadius: 28,
                maxWidth: 360,
                margin: "44px auto 0",
                padding: "20px 24px",
                textAlign: "left",
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

            {/* Primary CTA */}
            <Link
              to="/auth?signup=true"
              onClick={() => trackCta("landing_hero_cta_clicked")}
              style={{
                display: "inline-block",
                marginTop: 52,
                background: "#2F6F4E",
                color: "#F0EDEA",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                padding: "16px 36px",
                borderRadius: 2,
                textDecoration: "none",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#265E41")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2F6F4E")}
            >
              Start watching — free forever
            </Link>

            {/* Fine print */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.05em",
                color: "rgba(26, 47, 30, 0.5)",
                margin: 0,
                marginTop: 16,
              }}
            >
              No credit card · 60-second setup · Cancel whenever
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
            borderTop: "0.5px solid rgba(26, 47, 30, 0.1)",
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
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: isNarrow ? 10 : 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: isNarrow ? "0.1em" : "0.15em",
              color: "rgba(26, 47, 30, 0.5)",
              textAlign: "center",
              margin: 0,
              lineHeight: 1.8,
            }}
          >
            YOSEMITE · ZION · GLACIER · GRAND CANYON
            <br />
            GRAND TETON · ARCHES · ROCKY MOUNTAIN · RAINIER
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — THE METHOD (dark bleed)
            ═══════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          style={{
            background: "#1A2F1E",
            color: "#F0EDEA",
            paddingTop: isMobile ? 64 : 96,
            paddingBottom: isMobile ? 64 : 96,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* Eyebrow */}
            <div
              style={{
                textAlign: "center",
                marginBottom: 24,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#C9A96E",
              }}
            >
              — THE METHOD
            </div>

            {/* Headline */}
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: isNarrow ? 26 : 44,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#F0EDEA",
                textAlign: "center",
                marginTop: 0,
                marginBottom: isMobile ? 48 : 64,
                textWrap: "balance",
              }}
            >
              Three steps. One alert.
              <br />
              <span style={{ fontStyle: "italic", color: "#A8C4B8" }}>
                Everything else happens while you sleep.
              </span>
            </h2>

            {/* Steps */}
            <div
              style={{
                maxWidth: 520,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? 36 : 48,
              }}
            >
              {[
                {
                  numeral: "i.",
                  title: "Tell Poko which permit you want",
                  body:
                    "Pick the park, the permit, the dates. Takes about a minute. That's the last thing you do.",
                },
                {
                  numeral: "ii.",
                  title: "Poko scans every two minutes",
                  body:
                    "Recreation.gov gets scanned every two minutes. Cancellations drop hardest between 10pm and 6am. We're there.",
                },
                {
                  numeral: "iii.",
                  title: "The text arrives. You have four minutes.",
                  body:
                    "We send the link. You book fast. The permit's yours if you're faster than the next person refreshing Recreation.gov.",
                },
              ].map((step) => (
                <div
                  key={step.numeral}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "36px 1fr" : "48px 1fr",
                    columnGap: isMobile ? 20 : 24,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 32,
                      fontWeight: 400,
                      lineHeight: 1,
                      color: "#C9A96E",
                    }}
                  >
                    {step.numeral}
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: isMobile ? 18 : 22,
                        fontWeight: 400,
                        color: "#F0EDEA",
                        margin: 0,
                        marginBottom: 8,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "rgba(240, 237, 234, 0.65)",
                        margin: 0,
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4.5 — PRICING
            ═══════════════════════════════════════════════════ */}
        <section
          id="pricing"
          style={{
            background: "#F0EDEA",
            paddingTop: isMobile ? 64 : 96,
            paddingBottom: isMobile ? 48 : 64,
            paddingLeft: isMobile ? 20 : 24,
            paddingRight: isMobile ? 20 : 24,
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "#2F6F4E",
                  marginBottom: 20,
                }}
              >
                — PRICING
              </div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: isNarrow ? 26 : 44,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#1A2F1E",
                  marginTop: 0,
                  marginBottom: 12,
                  textWrap: "balance",
                }}
              >
                Free works for wilderness permits. Pro wins Half Dome.
              </h2>
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: 18,
                  fontWeight: 400,
                  color: "rgba(26, 47, 30, 0.6)",
                  margin: "0 auto",
                  maxWidth: 540,
                }}
              >
                Both plans include Poko — our AI guide who knows every trail, permit, and crowd window.
              </p>
            </div>

            {/* Card grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                gap: 16,
              }}
            >
              {/* FREE CARD */}
              <div
                style={{
                  background: "transparent",
                  border: "0.5px solid rgba(26, 47, 30, 0.2)",
                  borderRadius: 2,
                  padding: isMobile ? "28px 24px" : "36px 28px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "rgba(26, 47, 30, 0.5)",
                    marginBottom: 16,
                  }}
                >
                  FREE
                </div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 44,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: "#1A2F1E",
                    marginBottom: 4,
                  }}
                >
                  $0
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "rgba(26, 47, 30, 0.55)",
                    marginBottom: 32,
                  }}
                >
                  Forever
                </div>

                <div
                  style={{
                    borderTop: "0.5px solid rgba(26, 47, 30, 0.1)",
                    paddingTop: 24,
                    marginBottom: 32,
                    flex: 1,
                  }}
                >
                  {[
                    "One permit tracker",
                    "Email alerts",
                    "5-minute scans",
                    "Poko AI park guide",
                  ].map((f) => (
                    <p
                      key={f}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        lineHeight: 2,
                        color: "rgba(26, 47, 30, 0.75)",
                        margin: 0,
                      }}
                    >
                      {f}
                    </p>
                  ))}
                </div>

                <Link
                  to={ctaPath}
                  onClick={() => trackCta("landing_free_cta_clicked")}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    color: "#2F6F4E",
                    background: "transparent",
                    border: "0.5px solid #2F6F4E",
                    borderRadius: 2,
                    padding: 14,
                    textDecoration: "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(47, 111, 78, 0.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  Start free
                </Link>
              </div>

              {/* PRO CARD */}
              <div
                style={{
                  background: "#1A2F1E",
                  borderRadius: 2,
                  padding: isMobile ? "28px 24px" : "36px 28px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* RECOMMENDED badge */}
                <div
                  style={{
                    position: "absolute",
                    top: -9,
                    right: 24,
                    background: "#C9A96E",
                    color: "#1A2F1E",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 9,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    padding: "4px 10px",
                    borderRadius: 0,
                  }}
                >
                  RECOMMENDED
                </div>

                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "#C9A96E",
                    marginBottom: 16,
                  }}
                >
                  PRO
                </div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 44,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: "#F0EDEA",
                    marginBottom: 4,
                  }}
                >
                  $9.99
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "rgba(240, 237, 234, 0.55)",
                    marginBottom: 32,
                  }}
                >
                  per month · cancel anytime
                </div>

                <div
                  style={{
                    borderTop: "0.5px solid rgba(240, 237, 234, 0.15)",
                    paddingTop: 24,
                    marginBottom: 32,
                    flex: 1,
                  }}
                >
                  {[
                    { text: "Everything in Free", accent: false },
                    { text: "2-minute scans — 2.5× faster", accent: true },
                    { text: "Unlimited trackers", accent: false },
                    { text: "SMS + Email alerts", accent: false },
                    { text: "All 8 parks", accent: false },
                  ].map((f) => (
                    <p
                      key={f.text}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        lineHeight: 2,
                        color: "rgba(240, 237, 234, 0.85)",
                        margin: 0,
                      }}
                    >
                      {f.accent ? (
                        <span style={{ color: "#C9A96E", fontWeight: 500 }}>
                          {f.text}
                        </span>
                      ) : (
                        f.text
                      )}
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => {
                    trackCta("landing_pro_cta_clicked");
                    handleProCheckout();
                  }}
                  disabled={proLoading}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    color: "#1A2F1E",
                    background: "#C9A96E",
                    border: "none",
                    borderRadius: 2,
                    padding: 14,
                    cursor: proLoading ? "not-allowed" : "pointer",
                    opacity: proLoading ? 0.6 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {proLoading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Loader2 size={14} className="animate-spin" />
                      Opening checkout…
                    </span>
                  ) : (
                    "Upgrade to Pro →"
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4.75 — EDITORIAL CODA
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            background: "#F0EDEA",
            paddingTop: isNarrow ? 48 : 64,
            paddingBottom: isNarrow ? 40 : 48,
            paddingLeft: isNarrow ? 20 : 24,
            paddingRight: isNarrow ? 20 : 24,
          }}
        >
          <p
            style={{
              maxWidth: 520,
              margin: "0 auto",
              textAlign: "center",
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontWeight: isNarrow ? 500 : 400,
              fontSize: isNarrow ? 18 : 22,
              lineHeight: 1.4,
              color: "rgba(26, 47, 30, 0.65)",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            Permits are waiting. So is your phone.
          </p>
        </section>

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
