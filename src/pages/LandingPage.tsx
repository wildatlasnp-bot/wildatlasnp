import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Search, MessageSquare, Radio, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";


const steps = [
  {
    num: "01",
    icon: Search,
    title: "Tell Poko which permit you need",
    desc: "Choose the permit you need — Half Dome cables, Wilderness, and more.",
  },
  {
    num: "02",
    icon: Radio,
    title: "Poko watches while you live your life",
    desc: "Scans Recreation.gov every 2 minutes — day and night.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "You get the text. You book the permit.",
    desc: "The window is 2–4 minutes. We make sure you're already moving.",
  },
];


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
  const [alertCardVisible, setAlertCardVisible] = useState(false);
  const [amberCalloutVisible, setAmberCalloutVisible] = useState(false);
  const alertCardRef = useRef<HTMLDivElement>(null);
  const amberCalloutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target === alertCardRef.current) setAlertCardVisible(true);
          if (entry.target === amberCalloutRef.current) setAmberCalloutVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    if (alertCardRef.current) observer.observe(alertCardRef.current);
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
            SECTION 4 — HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" style={{ paddingTop: 19 }} className="mb-14">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.08 }}
              className="text-center mb-10"
            >
              <motion.h2
                variants={scrollReveal}
                custom={0}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontSize: "clamp(36px, 4vw, 52px)",
                  color: "#1A1A17",
                  letterSpacing: "-0.02em",
                  marginBottom: 16,
                }}
              >
                Set it up in 60 seconds. Poko does the rest.
              </motion.h2>
              <motion.p variants={scrollReveal} custom={1} style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64" }}>
                Half Dome permits vanish in 4 minutes. WildAtlas catches them.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.08 }}
              className="space-y-10"
            >
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  variants={scrollReveal}
                  custom={i + 2}
                  className={`flex gap-6 items-start ${step.num === "02" ? "items-center justify-between" : "py-3"}`}
                >
                  <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14">
                    <step.icon size={22} strokeWidth={1.8} style={{ color: "rgba(47,111,78,0.6)" }} className="mb-1" />
                    <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.14em", color: "rgba(0,0,0,0.25)", fontWeight: 400 }}>{step.num}</span>
                  </div>
                  <div className="pt-1 flex-1 min-w-0">
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 as const, fontSize: 15, color: "#1A1A17", letterSpacing: "-0.01em", marginBottom: 6 }}>{step.title}</h3>
                    <p style={{ fontSize: 14, color: "#6B6A64", lineHeight: 1.65 }} className="max-w-md">{step.desc}</p>
                    {step.num === "02" && (
                      <div ref={amberCalloutRef} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FAEEDA", borderRadius: 8, padding: "10px 12px", marginTop: 10, opacity: amberCalloutVisible ? 1 : 0, transform: amberCalloutVisible ? "translateY(0)" : "translateY(12px)", transition: "opacity 350ms ease-out 150ms, transform 350ms ease-out 150ms" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#BA7517", flexShrink: 0, marginTop: 5 }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#854F0B", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                          Most cancellations drop between 10pm and 6am — Poko never sleeps.
                        </span>
                      </div>
                    )}
                  </div>
                  {step.num === "02" && (
                    <div className="shrink-0 mr-1">
                      <img
                        src="/mochi-binoculars.png"
                        alt="Poko scanning for permits"
                        className="w-[80px] h-auto"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
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
