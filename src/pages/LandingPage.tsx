import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Mountain, Zap, Bell, Smartphone, Map, Search, MessageSquare, Radio, CalendarDays, Check, Loader2 } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";

import wildatlasLogo from "@/assets/wildatlas-logo-shield.png";

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
    title: "Choose your permits",
    desc: "Select the permits you want to monitor — Half Dome, Wilderness, cables, and more.",
  },
  {
    num: "02",
    icon: Radio,
    title: "We scan continuously",
    desc: "WildAtlas scans Recreation.gov around the clock so you don't have to.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "Get alerted instantly",
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

const LandingPage = () => {
  const { user } = useAuth();
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
  const finalCtaLabel = user ? "Open App" : "Start Monitoring Free";

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

      <div className="min-h-screen bg-background">
        {/* ── Nav ── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={wildatlasLogo} alt="WildAtlas" className="w-8 h-8 object-contain" />
              <span className="font-heading font-bold text-foreground text-lg tracking-tight">WildAtlas</span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  to="/app"
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-sm"
                  style={{ background: "#2f6e4c", color: "#fff" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                >
                  Open App <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                  <Link
                    to="/auth?signup=true"
                    className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-sm"
                    style={{ background: "#2f6e4c", color: "#fff" }}
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
            backgroundColor: "#F0EDEA",
            backgroundImage: "none",
            minHeight: "95vh",
            isolation: "isolate",
          }}
        >
          {/* Ghosted W */}
          <span
            aria-hidden="true"
            className="absolute pointer-events-none select-none"
            style={{
              right: -80,
              bottom: -60,
              zIndex: 0,
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 600,
              fontWeight: 200,
              color: "rgba(47,111,78,0.04)",
              lineHeight: 1,
            }}
          >
            W
          </span>

          <div
            className="relative z-10 mx-auto grid items-center"
            style={{
              maxWidth: 1200,
              padding: "0 56px",
              gap: 0,
              gridTemplateColumns: "1fr 1fr",
              minHeight: "calc(95vh - 64px)",
            }}
          >
            {/* ── Left column ── */}
            <div className="flex flex-col justify-center py-12">
              <h1 style={{ margin: 0 }}>
                <span
                  className="hero-headline-line"
                  style={{
                    display: "block",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 200,
                    fontSize: "clamp(80px, 13vw, 160px)",
                    lineHeight: 0.88,
                    letterSpacing: "-0.03em",
                    color: "#1A1A17",
                    whiteSpace: "nowrap",
                  }}
                >
                  The permit
                </span>
                <span
                  className="hero-headline-line"
                  style={{
                    display: "block",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 200,
                    fontStyle: "italic",
                    fontSize: "clamp(80px, 13vw, 160px)",
                    lineHeight: 0.88,
                    letterSpacing: "-0.03em",
                    color: "rgba(26,26,23,0.22)",
                    whiteSpace: "nowrap",
                    paddingLeft: "clamp(40px, 8vw, 120px)",
                    marginTop: "0.1em",
                  }}
                >
                  opens.
                </span>
                <span
                  className="hero-headline-line-small"
                  style={{
                    display: "block",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 200,
                    fontSize: "clamp(48px, 7vw, 88px)",
                    lineHeight: 0.88,
                    letterSpacing: "-0.03em",
                    color: "#2F6F4E",
                    textAlign: "right",
                    paddingRight: 20,
                    whiteSpace: "nowrap",
                    marginTop: "0.15em",
                  }}
                >
                  Be first.
                </span>
              </h1>

              {/* Subtext */}
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 300,
                  color: "#6B6A64",
                  lineHeight: 1.85,
                  maxWidth: 360,
                  marginTop: 32,
                  marginBottom: 24,
                }}
              >
                WildAtlas monitors Recreation.gov every 2 minutes, around the clock. The moment a cancellation appears at Half Dome, Zion Narrows, or any of your parks — you know instantly.
              </p>

              {/* CTA */}
              <div>
                <Link
                  to={ctaPath}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#1A1A17",
                    color: "#fff",
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
              </div>

              {/* Stats strip */}
              <div
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.07)",
                  marginTop: 24,
                  paddingTop: 16,
                  display: "flex",
                }}
              >
                {[
                  { value: "2m", label: "Scan interval" },
                  { value: "8", label: "Parks monitored" },
                  { value: "100+", label: "Permits found" },
                ].map((stat, i, arr) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      paddingRight: i < arr.length - 1 ? 32 : 0,
                      paddingLeft: i === arr.length - 1 ? 32 : 0,
                      borderRight: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 48,
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
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase" as const,
                        color: "#6B6A64",
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right column — Phone mockup ── */}
            <div className="flex items-center justify-center">
              <div className="w-[300px] sm:w-[320px] md:w-[340px]">
                {/* White iPhone shell */}
                <div
                  className="rounded-[3rem] bg-[hsl(0_0%_100%)] p-[3px]"
                  style={{
                    boxShadow:
                      "0 40px 80px -15px hsl(var(--foreground) / 0.22), 0 16px 40px -10px hsl(var(--foreground) / 0.10), inset 0 1px 0 hsl(0 0% 100% / 0.9)",
                  }}
                >
                  {/* Inner bezel */}
                  <div className="rounded-[2.85rem] bg-foreground/[0.04] p-[2px]">
                    {/* Screen */}
                    <div className="rounded-[2.75rem] bg-card overflow-hidden relative">
                      {/* Dynamic Island */}
                      <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-[84px] h-[24px] bg-foreground/[0.85] rounded-full z-10 flex items-center justify-center">
                        <div className="w-[7px] h-[7px] rounded-full bg-foreground/20" />
                      </div>

                      {/* Status bar */}
                      <div className="flex items-center justify-between px-7 pt-3.5 pb-1 relative z-20">
                        <span className="text-[11px] font-semibold text-muted-foreground">9:41</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-[2px] items-end">
                            <div className="w-[3px] h-[5px] rounded-[1px] bg-muted-foreground/50" />
                            <div className="w-[3px] h-[7px] rounded-[1px] bg-muted-foreground/50" />
                            <div className="w-[3px] h-[9px] rounded-[1px] bg-muted-foreground/50" />
                            <div className="w-[3px] h-[11px] rounded-[1px] bg-muted-foreground/30" />
                          </div>
                          <div className="ml-1 w-[20px] h-[9px] rounded-[2px] border border-muted-foreground/40 relative">
                            <div className="absolute inset-[1.5px] right-[3px] rounded-[0.5px] bg-primary" />
                            <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1.5px] h-[4px] rounded-r-full bg-muted-foreground/40" />
                          </div>
                        </div>
                      </div>

                      {/* Screen content — notification-first layout */}
                      <div className="pt-4 pb-4 px-3.5 bg-gradient-to-b from-card to-muted/15">
                        {/* Notification */}
                        <div>
                          <div
                            className="rounded-[18px] bg-[hsl(0_0%_100%)] p-3.5"
                            style={{
                              boxShadow: "0 6px 24px hsl(var(--foreground) / 0.08), 0 2px 6px hsl(var(--foreground) / 0.04)",
                              border: "1px solid hsl(var(--border) / 0.5)",
                            }}
                          >
                            {/* App header */}
                            <div className="flex items-center gap-2.5 mb-2">
                              <div className="w-[22px] h-[22px] rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                                <Mountain size={11} className="text-primary-foreground" strokeWidth={2.5} />
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.08em]">WildAtlas Alert</span>
                              <span className="text-[10px] text-muted-foreground/40 ml-auto">now</span>
                            </div>

                            {/* Message */}
                            <p className="text-[14px] font-bold text-foreground leading-snug tracking-[-0.01em]">
                              Permit available — Half Dome cables
                            </p>
                            <p className="text-[12px] text-muted-foreground leading-snug mt-1">
                              July 14 · 2 spots remaining
                            </p>

                            {/* CTA */}
                            <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-center">
                              <span className="text-[12px] font-semibold text-primary">Tap to book →</span>
                            </div>
                          </div>
                        </div>

                        {/* Subtle second notification hint */}
                        <div className="mt-2.5 mx-2 h-[32px] rounded-2xl bg-muted/40 border border-border/20" />
                      </div>

                      {/* Home indicator */}
                      <div className="flex justify-center py-2.5 bg-muted/15">
                        <div className="w-[100px] h-[4px] rounded-full bg-foreground/12" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" className="mt-24 mb-24">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-20"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-4 tracking-tight"
              >
                Three steps to your permit
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-base md:text-lg leading-relaxed">
                Set it up once. We handle the rest.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="space-y-10"
            >
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  variants={fadeUp}
                  custom={i + 2}
                  className={`flex gap-6 items-start ${step.num === "02" ? "items-center justify-between" : "py-3"}`}
                >
                  <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14">
                    <step.icon size={22} strokeWidth={1.8} className="text-primary mb-1" />
                    <span className="text-[10px] font-bold text-muted-foreground">{step.num}</span>
                  </div>
                  <div className="pt-1 flex-1 min-w-0">
                    <h3 className={`font-heading font-bold text-foreground mb-1.5 tracking-tight ${step.num === "02" ? "text-[16px] whitespace-nowrap" : "text-[1.1rem]"}`}>{step.title}</h3>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md">{step.desc}</p>
                  </div>
                  {step.num === "02" && (
                    <div className="relative shrink-0 mr-1">
                       {/* Callout annotation above-left of Mochi */}
                      <motion.div
                        className="pointer-events-none absolute flex flex-col items-start -left-[72px] -top-[44px]"
                        style={{ transform: "rotate(-8deg)" }}
                        initial={{ opacity: 0, scale: 0.9, y: 8 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
                      >
                        <span
                          style={{
                            fontFamily: "'Caveat', cursive",
                            fontSize: 18,
                            fontWeight: 600,
                            color: "#2F6F4E",
                            lineHeight: 1.1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Say hi to Mochi!
                        </span>
                        <motion.svg
                          width="60"
                          height="28"
                          viewBox="0 0 60 28"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-8 overflow-visible"
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true, margin: "-40px" }}
                          transition={{ duration: 0.2, delay: 0.35, ease: "easeOut" }}
                        >
                          <motion.path
                            d="M4 3 C14 5, 28 10, 38 16 C44 20, 48 23, 50 26"
                            stroke="#2F6F4E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            fill="none"
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
                          />
                          <motion.path
                            d="M43 21 L51 27 L55 19"
                            stroke="#2F6F4E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.2, delay: 0.7, ease: "easeOut" }}
                          />
                        </motion.svg>
                      </motion.div>
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
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-14"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-4 tracking-tight"
              >
                Simple, honest pricing.
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-base md:text-lg leading-relaxed">
                Start free. Upgrade when you're ready.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            >
              {/* Free Plan */}
              <motion.div
                variants={fadeUp}
                custom={2}
                className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 flex flex-col"
              >
                <div className="mb-5">
                  <h3 className="text-2xl font-heading font-bold text-foreground">Free</h3>
                  <p className="text-[13px] text-muted-foreground mt-1">Forever</p>
                </div>
                <div className="border-t border-border/60 pt-5 flex-1">
                  <ul className="space-y-3">
                    {["1 active permit tracker", "Email alerts", "Crowd windows & park guide", "Mochi AI park assistant"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check size={15} className="text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-[13px] text-foreground leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={ctaPath}
                  className="mt-6 flex items-center justify-center gap-2 border-2 border-primary text-primary rounded-xl px-5 py-3 text-[14px] font-bold hover:bg-primary/5 transition-all"
                >
                  Get Started Free <ArrowRight size={15} />
                </Link>
              </motion.div>

              {/* Pro Plan */}
              <motion.div
                variants={fadeUp}
                custom={3}
                className="relative bg-card rounded-2xl p-6 sm:p-8 flex flex-col"
                style={{ border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
              >
                <div className="mb-5">
                  <h3 className="text-2xl font-heading font-bold" style={{ color: "#2f6e4c" }}>$9.99</h3>
                  <p className="text-[13px] text-muted-foreground mt-1">per month</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', letterSpacing: '0.04em' }}>most popular</p>
                </div>
                <div className="border-t border-border/60 pt-5 flex-1">
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
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold transition-all shadow-md disabled:opacity-60"
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
              variants={fadeUp}
              custom={4}
              className="text-center text-[12px] text-muted-foreground mt-8"
            >
              Cancel anytime · No contracts · No credit card required for free plan.
            </motion.p>
          </div>
        </section>

        <section className="pt-12 pb-12">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-5 leading-tight tracking-tight"
              >
                Permits disappear in minutes.
                <br />
                <span style={{ color: "#C4A96A" }}>Be ready in seconds.</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="text-muted-foreground text-base md:text-lg mb-12 max-w-md mx-auto leading-relaxed"
              >
                Stop refreshing Recreation.gov. Start getting alerts.
              </motion.p>
              <motion.div variants={fadeUp} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2.5 rounded-xl px-9 py-4.5 text-base font-bold transition-all shadow-lg"
                  style={{ background: "#2f6e4c", color: "#fff", boxShadow: "0 10px 25px -5px rgba(47,110,76,0.3)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#24503a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#2f6e4c")}
                >
                  {finalCtaLabel}
                  <ArrowRight size={18} strokeWidth={2.5} />
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
              <img src={wildatlasLogo} alt="WildAtlas" className="w-6 h-6 object-contain" />
              <span className="font-heading font-bold text-foreground text-sm tracking-tight">WildAtlas</span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=59c2e394-d476-41da-9349-3e3c4a96f375" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=c730f7d6-371c-4e8b-8d57-7577fca052d3" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms & Conditions</a>
              <span>© 2026 WildAtlas</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
