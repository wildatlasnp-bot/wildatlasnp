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

import mochiWave from "@/assets/mochi-wave-transparent.png";

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
    desc: "Select the permits you want to monitor — Half Dome, Wilderness, cables, and more.",
  },
  {
    num: "02",
    icon: Radio,
    title: "Mochi watches while you live your life",
    desc: "WildAtlas scans Recreation.gov every 2 minutes — through the night, through the season. Most cancellations appear between 10pm and 6am. Mochi catches them.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "You get the text. You book the permit.",
    desc: "You get an alert the moment a permit opens — email on Free, SMS with Pro.",
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
        <nav className="hero-anim-nav fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
          <div className="max-w-5xl mx-auto h-16 flex items-center justify-between" style={{ padding: isMobile ? "0 20px" : "0 2rem" }}>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: "#1A1814", letterSpacing: "0.03em" }}>WildAtlas</span>
            </div>

            {/* Live status pill */}
            <div
              style={{
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 30,
                padding: "7px 16px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
                maxWidth: 110,
                overflow: "hidden",
              }}
            >
              <div
                className="hero-anim-dot-glow"
                style={{
                  width: 6,
                  height: 6,
                  background: "#4ADE80",
                  borderRadius: "50%",
                  boxShadow: "0 0 4px #4ADE80",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  color: "#2F6F4E",
                  whiteSpace: "nowrap" as const,
                  overflow: "hidden",
                }}
              >
                • 8 parks live
              </span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  to="/app"
                  className="flex items-center gap-1.5 rounded-xl font-semibold transition-all shadow-sm"
                  style={{ background: "#2f6e4c", color: "#fff", fontSize: 14, padding: "8px 16px", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                >
                  Open App <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  {!isMobile && (
                    <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Sign In
                    </Link>
                  )}
                  <Link
                    to="/auth?signup=true"
                    className="flex items-center gap-1.5 rounded-xl font-semibold transition-all shadow-sm"
                    style={{ background: "#2f6e4c", color: "#fff", fontSize: 14, padding: "8px 16px", whiteSpace: "nowrap" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                  >
                    Get Started <ArrowRight size={14} />
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
          className="relative pt-16 overflow-hidden"
          style={{
            background: "#F0EDEA",
            minHeight: isMobile ? "auto" : "95vh",
            isolation: "isolate",
          }}
        >
          {/* Hero background photo */}
          <img
            src={getParkConfig("yosemite").heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ zIndex: 0 }}
          />
          {/* Gradient scrim */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              background: "linear-gradient(to bottom, rgba(240,237,234,0.0) 0%, rgba(240,237,234,0.0) 30%, rgba(240,237,234,0.7) 65%, rgba(240,237,234,1.0) 100%)",
            }}
          />

          <div
            className="relative z-10 mx-auto flex flex-col items-center text-center justify-end"
            style={{
              maxWidth: 720,
              padding: isMobile ? "0 24px 0" : "0 56px 0",
              minHeight: isMobile ? "70vh" : "calc(95vh - 64px)",
            }}
          >
            <img
              src={mochiWave}
              alt="Mochi"
              style={{
                width: 80,
                animation: "mochi-hero-enter 0.7s cubic-bezier(0.22,1,0.36,1) both",
              }}
            />
            <style>{`@keyframes mochi-hero-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <h1 className="hero-anim-headline" style={{ margin: "24px 0 0" }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 200,
                  fontSize: "clamp(40px, 7vw, 56px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#1A1814",
                }}
              >
                The permit opens.
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 200,
                  fontStyle: "italic",
                  fontSize: "clamp(40px, 7vw, 56px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#2F6F4E",
                  marginTop: "0.1em",
                }}
              >
                Be first.
              </span>
            </h1>

            {/* Subtext */}
            <p
              className="hero-anim-subtext"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 300,
                color: "#6B6A64",
                lineHeight: 1.7,
                maxWidth: 420,
                marginTop: 20,
                marginBottom: 16,
              }}
            >
              {isMobile
                ? "Half Dome permits vanish in minutes. WildAtlas texts you the moment one opens — so you're ready when it does."
                : "Half Dome permits for July are gone before most people finish their coffee. WildAtlas watches Recreation.gov around the clock and texts you the moment a cancellation appears — so you're ready the moment the next opening appears."}
            </p>

            {/* CTA */}
            <div className="hero-anim-cta" style={{ marginBottom: 20, width: "100%", maxWidth: 320 }}>
              <Link
                to={ctaPath}
                className="hero-cta-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  background: "#2F6F4E",
                  color: "#F0EDEA",
                  padding: "16px 36px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.04em",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {ctaLabel}
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  color: "rgba(0,0,0,0.25)",
                  letterSpacing: "0.06em",
                  marginTop: 12,
                }}
              >
                Free forever · No credit card · Cancel anytime
              </p>
              <span
                style={{
                  display: "block",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 300,
                  color: "rgba(0,0,0,0.25)",
                  letterSpacing: "0.04em",
                  marginTop: 8,
                }}
              >
                Independent service. Not affiliated with the NPS or Recreation.gov.
              </span>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "rgba(58,62,59,0.55)",
                  marginTop: 12,
                  marginBottom: 0,
                }}
              >
                Join hikers already watching for permits across 8 national parks.
              </p>
            </div>

            {/* Stats strip */}
            <div
              className="hero-anim-stats"
              style={{
                borderTop: "1px solid rgba(0,0,0,0.07)",
                marginTop: 24,
                paddingTop: 16,
                display: "flex",
                width: "100%",
                maxWidth: 480,
              }}
            >
              {[
                { value: "2 min", label: isMobile ? "Scan interval" : "Scan interval" },
                { value: "8", label: isMobile ? "Parks" : "National parks" },
                { value: "100+", label: isMobile ? "Permit types" : "Permit types tracked" },
              ].map((stat, i, arr) => (
                <div
                  key={stat.label}
                  style={{
                    flex: 1,
                    paddingRight: i < arr.length - 1 ? (isMobile ? 16 : 32) : 0,
                    paddingLeft: i === arr.length - 1 ? (isMobile ? 16 : 32) : 0,
                    borderRight: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: isMobile ? 36 : 48,
                      fontWeight: 200,
                      color: "#1A1A17",
                      lineHeight: 1,
                      marginBottom: 4,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: isMobile ? 8 : 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase" as const,
                      color: "#6B6A64",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Spacer for bottom */}
            <div style={{ height: isMobile ? 40 : 60 }} />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" style={{ paddingTop: 64 }} className="mb-24">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.08 }}
              className="text-center mb-20"
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
                Half Dome permits vanish in under 4 minutes. Here's how WildAtlas changes that.
              </motion.p>
              <motion.p variants={scrollReveal} custom={1.5} style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "rgba(0,0,0,0.4)", fontStyle: "italic", maxWidth: 480, margin: "16px auto 0", marginBottom: 0 }}>
                Mochi is your AI park companion — he knows your parks, watches for openings, and briefs you before every trip.
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
        <section className="mt-24 mb-24">
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
                  fontSize: isMobile ? 32 : "clamp(36px, 4vw, 52px)",
                  color: "#1A1A17",
                  letterSpacing: "-0.02em",
                  marginBottom: 16,
                }}
              >
                Start free. Get the permit you've been chasing.
              </motion.h2>
              <motion.p variants={scrollReveal} custom={1} style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64" }}>
                Free gets you started. Pro gets you in faster.
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
                  className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] transition-all"
                  style={{ border: "1px solid rgba(47,111,78,0.4)", color: "rgba(47,111,78,0.65)", background: "transparent", fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#2F6F4E"; e.currentTarget.style.color = "#2F6F4E"; e.currentTarget.style.background = "rgba(47,111,78,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(47,111,78,0.4)"; e.currentTarget.style.color = "rgba(47,111,78,0.65)"; e.currentTarget.style.background = "transparent"; }}
                >
                  Get Started Free <ArrowRight size={15} />
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
                    {["Everything in Free", "Priority scans every 2 min (vs. 5 min on Free)", "Unlimited permit trackers", "SMS + Email alerts", "Multi-park coverage"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check size={15} className="text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-[13px] text-foreground leading-snug">{f}</span>
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

        <section style={{ paddingTop: isMobile ? 48 : 60, paddingBottom: 48 }}>
          <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.08 }}>
              <motion.h2
                variants={scrollReveal}
                custom={0}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 300,
                  fontSize: "clamp(32px, 3.5vw, 52px)",
                  color: "#1A1A17",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  marginBottom: 20,
                }}
              >
                <span style={{ display: "block", whiteSpace: isMobile ? "normal" : "nowrap" }}>Permits disappear in minutes.</span>
                <span style={{ display: "block", fontStyle: "italic", color: "#2F6F4E", fontSize: "clamp(32px, 3.5vw, 52px)" }}>Be ready in seconds.</span>
              </motion.h2>
              <motion.p
                variants={scrollReveal}
                custom={1}
                style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: "#6B6A64", marginBottom: 48, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}
              >
                The permit you've been waiting for is out there. Mochi is watching.
              </motion.p>
              <motion.div variants={scrollReveal} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2.5 transition-all"
                  style={{ background: "#2F6F4E", color: "#F0EDEA", padding: "16px 36px", borderRadius: 10, fontSize: 13, fontWeight: 500, letterSpacing: "0.04em" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#24503a"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#2F6F4E"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {finalCtaLabel}
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
