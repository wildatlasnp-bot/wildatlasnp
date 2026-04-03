import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Mountain, Zap, Bell, Smartphone, Map, Search, MessageSquare, Radio, CalendarDays, Check, Loader2 } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import { getParkConfig } from "@/lib/parks";

import mochiWave from "@/assets/mochi-wave.png";

const PARKS_MONITORED = ["Yosemite", "Rainier", "Zion", "Glacier", "Rocky Mountain", "Arches"];

const benefits = [
  {
    icon: Bell,
    title: "Instant permit alerts",
    desc: "Receive an SMS the moment a cancellation appears.",
  },
  {
    icon: Zap,
    title: "No more refreshing",
    desc: "WildAtlas runs frequent automated checks on Recreation.gov around the clock.",
  },
  {
    icon: Map,
    title: "Track multiple parks",
    desc: "Monitor Yosemite, Rainier, Zion, Glacier and more from one dashboard.",
  },
  {
    icon: Smartphone,
    title: "Alerts in your pocket",
    desc: "Manage alerts and watches directly from your mobile device.",
  },
];

const steps = [
  {
    num: "01",
    icon: Search,
    title: "Tell Mochi which permit you need",
    desc: "Choose the permit you need — Half Dome cables, Wilderness, and more.",
  },
  {
    num: "02",
    icon: Radio,
    title: "Mochi watches while you live your life",
    desc: "Scans Recreation.gov every 2 minutes — day and night.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "You get the text. You book the permit.",
    desc: "The window is 2–4 minutes. We make sure you're already moving.",
  },
];

const useCountUp = (end: number, duration = 1500, start = 0) => {
  const [value, setValue] = useState(start);
  const triggered = useRef(false);

  useEffect(() => {
    triggered.current = false;
    setValue(start);
  }, [end, start]);

  const trigger = useCallback(() => {
    if (triggered.current || end <= start) {
      if (end <= start) setValue(end);
      return;
    }

    triggered.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);

  return { value, trigger };
};

const TICKER_TEXT = PARKS_MONITORED.join(" · ") + " · ";

const ParkTicker = () => {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="inline-flex items-center gap-2.5 bg-black/35 backdrop-blur-md border border-white/10 rounded-full pl-4 pr-0 py-2 mb-10 max-w-[340px] sm:max-w-[420px] cursor-pointer select-none"
      onClick={() => setPaused((p) => !p)}
      role="button"
      aria-label={paused ? "Resume ticker" : "Pause ticker"}
    >
      <span className="text-[10px] font-bold text-white/95 uppercase tracking-[0.18em] shrink-0">
        Now Monitoring
      </span>
      <div className="overflow-hidden flex-1 mr-4" style={{ maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 88%, transparent 100%)" }}>
        <motion.div
          className="flex whitespace-nowrap"
          animate={{ x: paused ? 0 : "-50%" }}
          transition={paused ? { type: "spring", stiffness: 200, damping: 30 } : { x: { repeat: Infinity, repeatType: "loop", duration: 18, ease: "linear" } }}
        >
          <span className="text-[10px] text-white/55 font-medium tracking-wide">{TICKER_TEXT}</span>
          <span className="text-[10px] text-white/55 font-medium tracking-wide">{TICKER_TEXT}</span>
        </motion.div>
      </div>
    </div>
  );
};

const TOTAL_PARKS = 8;

const CountUpStats = ({ stats }: { stats: { found: number; scans: number } }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const parks = useCountUp(TOTAL_PARKS);
  const found = useCountUp(stats.found);

  useEffect(() => {
    if (isInView) {
      parks.trigger();
      found.trigger();
    }
  }, [isInView, parks, found, stats.found]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <div className="grid grid-cols-3 gap-4 max-w-[360px] mx-auto">
        {/* Pro scan interval */}
        <div className="flex flex-col items-center text-center gap-2.5">
          <Zap size={22} strokeWidth={1.8} className="text-primary" />
          <span className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-none tracking-tight">
            2 min
          </span>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
            Pro scan interval
          </p>
        </div>

        {/* Parks monitored */}
        <div className="flex flex-col items-center text-center gap-2.5">
          <Map size={22} strokeWidth={1.8} className="text-primary" />
          <span className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-none tracking-tight">
            {parks.value}
          </span>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
            Parks monitored
          </p>
        </div>

        {/* Permits found */}
        <div className="flex flex-col items-center text-center gap-2.5">
          <Bell size={22} strokeWidth={1.8} className="text-primary" />
          <span className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-none tracking-tight">
            {found.value}
          </span>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
            Permits found
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

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
  const [stats, setStats] = useState({ found: 0, scans: 0 });
  const heroRef = useRef<HTMLElement>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_landing_stats");
      const parsed = data as unknown as { watchers: number; found: number; total_finds: number; total_scans: number } | null;
      const found = parsed?.found ?? 0;
      const totalFinds = parsed?.total_finds ?? 0;
      const totalScans = parsed?.total_scans ?? 0;
      setStats({ found: Math.max(found, totalFinds), scans: totalScans });
    };
    load();
  }, []);

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
  
  const ctaLabel = user ? "Open App" : "Get Started Free";
  const finalCtaLabel = user ? "Open App" : "Get Started Free";

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
          className="hero-anim-nav fixed top-0 left-0 right-0 z-50 transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            background: navScrolled ? "rgba(240,237,234,0.92)" : "transparent",
            backdropFilter: navScrolled ? "blur(16px)" : "none",
            WebkitBackdropFilter: navScrolled ? "blur(16px)" : "none",
            borderBottom: navScrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent",
          }}
        >
          <div className="max-w-5xl mx-auto h-16 flex items-center justify-between" style={{ padding: isMobile ? "0 16px" : "0 2rem" }}>
            <div className="flex items-center gap-2 shrink-0">
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: navScrolled ? "#1A1814" : "#fff", letterSpacing: "0.03em", transition: "color 0.3s" }}>WildAtlas</span>
            </div>



            <div className="flex items-center gap-3 shrink-0">
              {user ? (
                <Link
                  to="/app"
                  className="flex items-center gap-1.5 rounded-xl font-semibold transition-all shadow-sm"
                  style={{ background: "#2f6e4c", color: "#fff", fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                >
                  Open App <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  {!isMobile && (
                    <Link to="/auth" className="font-medium transition-colors" style={{ fontSize: 13, color: navScrolled ? "#1a1a1a" : "#fff", whiteSpace: "nowrap", transition: "color 0.3s" }}>
                      Sign In
                    </Link>
                  )}
                  <Link
                    to="/auth?signup=true"
                    className="flex items-center gap-1.5 rounded-xl font-semibold transition-all shadow-sm"
                    style={{ background: "#2f6e4c", color: "#fff", fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                  >
                    Get Started <ArrowRight size={13} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>


        {/* ═══════════════════════════════════════════════════
            SECTION 1 — HERO
            ═══════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="relative overflow-hidden"
          style={{ background: "#F0EDEA", minHeight: "75vh" }}
        >
          {/* Hero background photo */}
          <img
            src={getParkConfig("yosemite").heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ zIndex: 0, objectPosition: "center top" }}
          />
          {/* Layer 1: warm dark overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: "rgba(15,10,5,0.48)" }} />
          {/* Layer 2: bottom fade to cream */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: "linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(240,237,234,0.7) 80%, rgba(240,237,234,1.0) 100%)" }} />

          <div
            className="relative flex flex-col items-center text-center justify-center"
            style={{ zIndex: 2, minHeight: "75vh", padding: "60px 24px 60px", maxWidth: 720, margin: "0 auto" }}
          >
            {/* Mochi */}
            <img
              src={mochiWave}
              alt="Mochi"
              style={{
                width: 94,
                marginBottom: 16,
                filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))",
                animation: "mochi-hero-enter 0.6s cubic-bezier(0.22,1,0.36,1) both",
              }}
            />
            <style>{`@keyframes mochi-hero-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Headline */}
            <h1 style={{ margin: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontSize: "clamp(44px, 8vw, 60px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                }}
              >
                Half Dome is yours to take.
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontStyle: "italic",
                  fontSize: "clamp(44px, 8vw, 60px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#A8D5B5",
                }}
              >
                Be the first to know.
              </span>
            </h1>

            {/* Subheadline */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 300,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 1.7,
                maxWidth: 380,
                marginTop: 20,
              }}
            >
              Permits vanish. Mochi texts you first.
            </p>

            {/* CTA */}
            <Link
              to={ctaPath}
              className="hero-cta-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "min(320px, calc(100% - 48px))",
                height: 52,
                background: "#2F6F4E",
                color: "#fff",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.04em",
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                marginTop: 28,
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#265E41")}
              onMouseLeave={e => (e.currentTarget.style.background = "#2F6F4E")}
            >
              {user ? "Open App →" : "Watch Half Dome now — it's free →"}
            </Link>

            {/* Trust line */}
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 12 }}>
              Free forever · No credit card · Cancel anytime
            </p>
          </div>

          {/* Parks line + scan strip */}
          {(() => {
            const recentFindsCount = 4;
            const recentFindsWindow = "6 hours";
            return (
              <div style={{ background: "#F0EDEA", padding: "4px 18px 10px", textAlign: "center" as const, position: "relative", zIndex: 3 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9a9a9a", lineHeight: 1.8, margin: 0 }}>
                  Also watching Zion, Glacier, Grand Canyon, Grand Teton, Arches, Rocky Mountain &amp; Rainier
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9a9a9a", lineHeight: 1.8, margin: 0 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#2F6F4E", marginRight: 6, verticalAlign: "middle" }} />
                  {recentFindsCount} Half Dome permits found in the last {recentFindsWindow}
                </p>
              </div>
            );
          })()}
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — ALERT CARD
            ═══════════════════════════════════════════════════ */}
        <section style={{ padding: "22px 24px 36px", background: "#F0EDEA" }}>
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" as const }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#9a9a9a", marginBottom: 20, textTransform: "uppercase" as const }}>
              This is what gets sent to your phone
            </p>
            <div ref={alertCardRef} style={{ maxWidth: 360, width: "calc(100% - 48px)", margin: "0 auto", background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", opacity: alertCardVisible ? 1 : 0, transform: alertCardVisible ? "translateY(0)" : "translateY(16px)", transition: "opacity 400ms ease-out, transform 400ms ease-out" }}>
              {/* Row 1 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2F6F4E", display: "inline-block", animation: "alertPulse 2s ease-in-out infinite" }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#2F6F4E" }}>WILDATLAS ALERT</span>
                </div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9a9a9a" }}>now</span>
              </div>
              {/* Row 2 */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginTop: 10, textAlign: "left" as const }}>
                Permit available — Half Dome cables
              </p>
              {/* Row 3 */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6b6b6b", marginTop: 4, textAlign: "left" as const }}>
                July 14 · 2 spots remaining
              </p>
              {/* Booking CTA line */}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#2F6F4E", marginTop: 8, textAlign: "left" as const }}>
                Tap to book on Recreation.gov →
              </p>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontStyle: "italic", color: "#9a9a9a", textAlign: "center", marginTop: 8, marginBottom: 8 }}>
              The people who got their permit this season had one thing in common.
            </p>
          </div>
          <style>{`@keyframes alertPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } } @keyframes navDotPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — TESTIMONIAL
            ═══════════════════════════════════════════════════ */}
        <section style={{ padding: "12px 24px 36px", background: "#F0EDEA" }}>
          <div style={{ maxWidth: 448, margin: "0 auto", textAlign: "center" as const }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#9a9a9a", marginBottom: 16, textTransform: "uppercase" as const }}>
              From the community
            </p>
            <div style={{ maxWidth: 400, width: "calc(100% - 48px)", margin: "0 auto", background: "#fff", borderRadius: 16, padding: 24 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: "italic", color: "#1a1a1a", lineHeight: 1.5, marginBottom: 16, textAlign: "left" as const }}>
                "Got my Half Dome permit in week 2. WildAtlas texted me at 11:04pm — I booked by 11:06."
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6B6A64", fontStyle: "italic" }}>
                — J.T.
              </p>
            </div>
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
                Set it up in 60 seconds. Mochi does the rest.
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
                          Most cancellations drop between 10pm and 6am — Mochi never sleeps.
                        </span>
                      </div>
                    )}
                  </div>
                  {step.num === "02" && (
                    <div className="shrink-0 mr-1">
                      <img
                        src="/mochi-binoculars.png"
                        alt="Mochi scanning for permits"
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
        <section className="mt-14 mb-14">
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
                Both include Mochi. Pro adds speed.
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
                    {["1 active permit tracker", "Email alerts", "Crowd windows & park guide", "Mochi AI park assistant"].map((f) => (
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
                <span style={{ display: "block", fontStyle: "italic", color: "rgba(255,255,255,0.8)", fontSize: "clamp(32px, 3.5vw, 52px)" }}>Mochi makes sure you're next.</span>
              </motion.h2>
              <motion.p
                variants={scrollReveal}
                custom={1}
                style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "rgba(255,255,255,0.7)", marginBottom: 48, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}
              >
                Set an alert in 60 seconds. Mochi watches while you sleep.
              </motion.p>
              <motion.div variants={scrollReveal} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2.5 transition-all"
                  style={{ background: "#FFFFFF", color: "#2F6F4E", padding: "14px 36px", borderRadius: 12, fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", border: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.92)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
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
