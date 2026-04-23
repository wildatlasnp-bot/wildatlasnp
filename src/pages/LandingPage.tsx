import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";




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
  const heroRef = useRef<HTMLElement>(null);


  const navigate = useNavigate();
  const { toast } = useToast();
  const [proLoading, setProLoading] = useState(false);
  const [amberCalloutVisible, setAmberCalloutVisible] = useState(false);
  const amberCalloutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target === amberCalloutRef.current) setAmberCalloutVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    if (amberCalloutRef.current) observer.observe(amberCalloutRef.current);
    return () => observer.disconnect();
  }, []);

  const ctaPath = user ? "/app" : "/auth?signup=true";


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
              {!isMobile && (
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
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#2F6F4E",
                  textDecoration: "underline",
                  textDecorationColor: "#2F6F4E",
                  textUnderlineOffset: 4,
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
            {/* Eyebrow */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#2F6F4E",
                margin: 0,
                marginBottom: 28,
              }}
            >
              — Now Watching Yosemite
            </p>

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
              You're asleep. We text you anyway.
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

            {/* Caption under bubble */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: "rgba(26, 47, 30, 0.45)",
                margin: 0,
                marginTop: 16,
              }}
            >
              The message 247 people received last Tuesday.
            </p>

            {/* Primary CTA */}
            <Link
              to="/auth?signup=true"
              style={{
                display: "inline-block",
                marginTop: 40,
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
            SECTION 3A — STATS STRIP
            ═══════════════════════════════════════════════════ */}
        <section
          style={{
            maxWidth: 680,
            margin: "0 auto",
            paddingTop: 48,
            paddingBottom: 24,
            paddingLeft: 20,
            paddingRight: 20,
            borderTop: "0.5px solid rgba(26, 47, 30, 0.1)",
            background: "#F0EDEA",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
            }}
          >
            {[
              { num: "2 min", label: "SCAN INTERVAL" },
              { num: "8", label: "PARKS WATCHED" },
              { num: "24/7", label: "NEVER SLEEPS" },
              { num: "60 sec", label: "TO SET UP" },
            ].map((stat, i) => {
              const dividerColor = "0.5px solid rgba(26, 47, 30, 0.08)";
              let borderStyle: React.CSSProperties = {};
              if (isMobile) {
                // 2x2 grid: right border on left column (i=0,2), bottom border on top row (i=0,1)
                if (i % 2 === 0) borderStyle.borderRight = dividerColor;
                if (i < 2) borderStyle.borderBottom = dividerColor;
              } else {
                if (i > 0) borderStyle.borderLeft = dividerColor;
              }
              return (
                <div
                  key={stat.label}
                  style={{
                    textAlign: "center",
                    paddingTop: 16,
                    paddingBottom: 16,
                    ...borderStyle,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 28,
                      fontWeight: 400,
                      lineHeight: 1,
                      color: "#1A2F1E",
                    }}
                  >
                    {stat.num}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "rgba(26, 47, 30, 0.55)",
                      marginTop: 6,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
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
              fontSize: isMobile ? 10 : 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: isMobile ? "0.1em" : "0.15em",
              color: "rgba(26, 47, 30, 0.5)",
              textAlign: "center",
              margin: 0,
              lineHeight: 1.8,
            }}
          >
            YOSEMITE · ZION · GLACIER · GRAND CANYON · GRAND TETON · ARCHES · ROCKY MOUNTAIN · RAINIER
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
                fontSize: isMobile ? 32 : 44,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#F0EDEA",
                textAlign: "center",
                marginTop: 0,
                marginBottom: isMobile ? 48 : 64,
              }}
            >
              Three steps. One alert.
              <br />
              <span style={{ fontStyle: "italic", color: "#A8C4B8" }}>
                Everything else is just waiting.
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
                  title: "Tell Poko what you want",
                  body:
                    "Pick the park, the permit, the dates. Takes about a minute. That's the last thing you do.",
                },
                {
                  numeral: "ii.",
                  title: "We watch while you don't",
                  body:
                    "Recreation.gov gets scanned every two minutes. Cancellations drop hardest between 10pm and 6am. We're there.",
                },
                {
                  numeral: "iii.",
                  title: "Your phone buzzes. You book.",
                  body:
                    "Spots vanish in two to four minutes. The text gives you the link. The rest is between you and rec.gov.",
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
        <section id="pricing" className="mt-14 mb-14">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.08 }}
              className="text-center mb-14"
            >
              <motion.h2
                variants={scrollReveal}
                custom={0}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontSize: isMobile ? 29 : "clamp(33px, 3.7vw, 49px)",
                  color: "#1A1A17",
                  letterSpacing: "-0.02em",
                  marginBottom: 16,
                }}
              >
                Two plans. One gets you in faster.
              </motion.h2>
              <motion.p variants={scrollReveal} custom={1} style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64" }}>
                Both include Poko. Pro adds speed.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.08 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            >
              {/* Free Plan */}
              <motion.div
                variants={scrollReveal}
                custom={2}
                style={{ background: "#F5F3F0", border: "none", boxShadow: "none", outline: "none", borderRadius: 16, cursor: "pointer" }}
                className="p-6 sm:p-8 flex flex-col"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="mb-5">
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 28, color: "#8A8A8A" }}>Free</h3>
                  <p style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64", marginTop: 4 }}>Forever</p>
                </div>
                <div className="border-t border-border/60 pt-5 flex-1" style={{ paddingBottom: 32 }}>
                  <ul className="space-y-3">
                    {["1 active permit tracker", "Email alerts", "Crowd windows & park guide", "Poko AI park assistant"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="shrink-0 mt-0.5" style={{ color: "#B0ABA5", fontSize: 15, lineHeight: "15px" }}>—</span>
                        <span className="text-[13px] leading-snug" style={{ color: "#9A9A9A" }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={ctaPath}
                  className="hover:bg-[rgba(47,111,78,0.06)]"
                  style={{ display: "block", textAlign: "center" as const, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#2F6F4E", background: "transparent", border: "1px solid rgba(47,111,78,0.4)", borderRadius: 100, padding: 11, textDecoration: "none", fontWeight: 500, width: "100%", cursor: "pointer" }}
                >
                  Start for free →
                </Link>
              </motion.div>

              {/* Pro Plan */}
              <motion.div
                variants={scrollReveal}
                custom={3}
                className="relative p-6 sm:p-8 flex flex-col"
                style={{ background: "#fff", border: "1.5px solid rgba(47,111,78,0.85)", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}
                whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(47,111,78,0.12)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {/* RECOMMENDED badge */}
                <div style={{ position: "absolute", top: 0, right: 0, background: "#2F6F4E", color: "#fff", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500, padding: "4px 10px", borderRadius: "0 16px 0 8px" }}>
                  Recommended
                </div>
                <div className="mb-5">
                  <h3 className="text-2xl font-heading font-bold" style={{ color: "#2F6F4E" }}>$9.99</h3>
                  <p style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64", marginTop: 4 }}>per month</p>
                </div>
                <div className="border-t border-border/60 pt-5 flex-1" style={{ paddingBottom: 32 }}>
                  <ul className="space-y-3">
                    {["Everything in Free", "2-min scans — 3× faster than Free", "Unlimited permit trackers", "SMS + Email alerts", "Multi-park coverage"].map((f, idx) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check size={15} className="text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-[13px] text-foreground leading-snug">
                          {idx === 1 ? <><strong style={{ fontWeight: 600 }}>2-min scans</strong>{" — 3× faster than Free"}</> : f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={handleProCheckout}
                  disabled={proLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold transition-all shadow-md disabled:opacity-60"
                  style={{ background: "#2f6e4c", color: "#fff" }}
                  onMouseEnter={e => { if (!proLoading) e.currentTarget.style.background = "#24503a"; }}
                  onMouseLeave={e => { if (!proLoading) e.currentTarget.style.background = "#2f6e4c"; }}
                >
                  {proLoading ? <><Loader2 size={15} className="animate-spin" /> Opening checkout…</> : <>Upgrade to Pro <ArrowRight size={15} /></>}
                </button>
              </motion.div>
            </motion.div>

            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scrollReveal}
              custom={4}
              style={{ textAlign: "center", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "rgba(0,0,0,0.35)", marginTop: 32 }}
            >
              Cancel anytime · No contracts · No credit card required for free plan.
            </motion.p>
          </div>
        </section>

        <section style={{ paddingTop: isMobile ? 28 : 36, paddingBottom: 28, background: "#2F6F4E" }}>
          <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.08 }}>
              <motion.h2
                variants={scrollReveal}
                custom={0}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontSize: "clamp(32px, 3.5vw, 52px)",
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  marginBottom: 20,
                }}
              >
                <span style={{ display: "block", whiteSpace: isMobile ? "normal" : "nowrap", color: "#FFFFFF" }}>You've been trying to get in.</span>
                <span style={{ display: "block", fontStyle: "italic", color: "rgba(255,255,255,0.8)", fontSize: "clamp(32px, 3.5vw, 52px)" }}>Poko makes sure you're next.</span>
              </motion.h2>
              <motion.p
                variants={scrollReveal}
                custom={1}
                style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "rgba(255,255,255,0.7)", marginBottom: 48, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}
              >
                Set an alert in 60 seconds. Poko watches while you sleep.
              </motion.p>
              <motion.div variants={scrollReveal} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2.5 transition-all"
                  style={{ background: "#FFFFFF", color: "#2F6F4E", padding: "14px 36px", borderRadius: 12, fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", border: "none" }}
                  onMouseEnter={e => { if (window.matchMedia("(hover: hover)").matches) { e.currentTarget.style.background = "#F0EDEA"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {user ? "Open App" : "Start watching permits — it's free"}
                  <ArrowRight size={15} strokeWidth={2.5} />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <div className="bg-background px-5 sm:px-8 py-6">
          <p className="text-[10px] text-muted-foreground/50 text-center max-w-xl mx-auto leading-relaxed">
            WildAtlas is an independent service and is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any government agency.
          </p>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-border/60 py-10 bg-background">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 400, color: "#1A1814", letterSpacing: "0.03em" }}>WildAtlas</span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
              <span>© 2026 WildAtlas</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
