import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Mountain, Zap, Bell, Smartphone, Map, Search, MessageSquare, Radio, CalendarDays, Check, Loader2 } from "lucide-react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import heroImage from "@/assets/yosemite-hero.jpg";

const PARKS_MONITORED = ["Yosemite", "Rainier", "Zion", "Glacier", "Rocky Mountain", "Arches"];

const benefits = [
  {
    icon: Bell,
    title: "Instant permit alerts",
    desc: "Receive an SMS the moment a cancellation appears.",
  },
  {
    icon: Zap,
    title: "Faster than manual refresh",
    desc: "WildAtlas checks Recreation.gov every 2 minutes during peak drop hours.",
  },
  {
    icon: Map,
    title: "Track multiple parks",
    desc: "Monitor Yosemite, Rainier, Zion, Glacier and more from one dashboard.",
  },
  {
    icon: Smartphone,
    title: "Built for your phone",
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
    desc: "WildAtlas checks Recreation.gov every few minutes, around the clock.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "Get alerted instantly",
    desc: "You receive an SMS the moment a permit opens. You book it before anyone else.",
  },
];

const useCountUp = (end: number, duration = 1500, start = 0) => {
  const [value, setValue] = useState(start);
  const triggered = useRef(false);

  const trigger = useCallback(() => {
    if (triggered.current || end <= 0) return;
    triggered.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-status-quiet status-dot-pulse" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-status-quiet" />
      </span>
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

const TOTAL_PARKS = 6;

const CountUpStats = ({ stats }: { stats: { found: number; scans: number } }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const parks = useCountUp(TOTAL_PARKS);

  useEffect(() => {
    if (isInView) {
      parks.trigger();
    }
  }, [isInView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground text-center mb-7">
        Permit Activity
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Scan cadence */}
        <div className="flex flex-col items-center text-center gap-2.5">
          <Zap size={22} strokeWidth={1.8} className="text-primary" />
          <p className="text-[13px] font-semibold text-foreground leading-snug mt-1">
            Scans every 2 min
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
          <p className="text-[11px] text-muted-foreground font-medium -mt-1">
            {PARKS_MONITORED.join(", ")} + more
          </p>
        </div>
      </div>

      {/* Trust line */}
      <div className="flex items-center justify-center gap-1.5 mt-7 pt-5 border-t border-border/60">
        <CalendarDays size={12} className="text-muted-foreground/60" />
        <span className="text-[11px] font-medium text-muted-foreground/70">Live since 2026</span>
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
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

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
  const finalCtaLabel = user ? "Open App" : "Start Monitoring Permits — Free";

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
        toast({ title: "🐻 Already subscribed!", description: "You're already a Pro member." });
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      console.error("Checkout error:", e);
      toast({ title: "🐻 Trail hiccup", description: "Couldn't start checkout. Please try again!" });
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
      "WildAtlas monitors Recreation.gov every 2 minutes and texts you the instant a permit cancellation drops for national parks like Yosemite and Rainier.",
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <Helmet>
        <title>WildAtlas — National Park Permit Alerts</title>
        <meta
          name="description"
          content="WildAtlas monitors Recreation.gov every 2 minutes and texts you the instant a permit cancellation drops. Yosemite, Rainier & more."
        />
        <link rel="canonical" href={`${siteUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* ── Nav ── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Mountain size={18} strokeWidth={2.2} />
              </div>
              <span className="font-heading font-bold text-foreground text-lg tracking-tight">WildAtlas</span>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  to="/app"
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:brightness-110 transition-all shadow-sm"
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
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:brightness-110 transition-all shadow-sm"
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
        <section ref={heroRef} className="relative pt-16 overflow-hidden">
          {/* Background image with parallax — full bleed */}
          <motion.div className="absolute inset-0 z-0 will-change-transform" style={{ y: heroY }}>
            <img
              src={heroImage}
              alt="Yosemite National Park valley at golden hour"
              className="w-full h-[120%] object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 via-[55%] to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 via-[8%] to-transparent" />
          </motion.div>

          <div className="relative z-10 px-5 sm:px-8 max-w-5xl mx-auto pt-24 pb-40 md:pt-36 md:pb-52">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl"
            >
              {/* Now monitoring pill with ticker */}
              <ParkTicker />

              <h1 className="text-[2.25rem] md:text-[3.75rem] font-heading font-bold text-white leading-[1.06] mb-6 drop-shadow-md">
                Permits sell out in minutes.{" "}
                <span className="text-secondary">WildAtlas watches for you.</span>
              </h1>

              <p className="text-[15px] md:text-lg text-white/75 max-w-lg mb-12 font-body leading-relaxed drop-shadow-sm">
                WildAtlas monitors Recreation.gov every few minutes and texts you the instant a cancellation appears — so you can book before anyone else.
              </p>

              <div className="flex flex-col items-start">
                <Link
                  to={ctaPath}
                  className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-8 py-4 text-[15px] font-bold hover:brightness-110 transition-all shadow-lg shadow-secondary/30"
                >
                  {ctaLabel}
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
                <p className="text-[12px] text-white/50 mt-3 font-medium">Free to start · No credit card required.</p>
                <p className="text-[12px] text-white/50 mt-1 font-medium">Pro plan from $9.99/mo — cancel anytime.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — SOCIAL PROOF / ACTIVITY
            ═══════════════════════════════════════════════════ */}
        <section className="mt-24 mb-24">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <CountUpStats stats={stats} />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — BENEFITS
            ═══════════════════════════════════════════════════ */}
        <section className="mt-24 mb-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-16"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-4 tracking-tight"
              >
                Why hikers choose WildAtlas
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="text-muted-foreground text-base md:text-lg max-w-md mx-auto leading-relaxed"
              >
                Every feature exists to get you from "sold out" to "booked."
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-6"
            >
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={fadeUp}
                  custom={i + 2}
                  className="p-4 sm:p-7 flex flex-col items-center text-center"
                >
                  <b.icon size={22} strokeWidth={1.8} className="text-primary mb-4" />
                  <h3 className="font-heading font-bold text-foreground text-[0.9rem] sm:text-[1.1rem] mb-2 tracking-tight leading-snug">{b.title}</h3>
                  <p className="text-[12px] sm:text-[14px] text-muted-foreground leading-relaxed">{b.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3.5 — INSTANT PERMIT ALERTS MOCKUP
            ═══════════════════════════════════════════════════ */}
        <section className="mt-24 mb-24 overflow-hidden">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center"
            >
              {/* Left — Copy */}
              <div>
                <motion.h2
                  variants={fadeUp}
                  custom={0}
                  className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-5 tracking-tight leading-tight"
                >
                  Get notified the moment a permit opens
                </motion.h2>
                <motion.p
                  variants={fadeUp}
                  custom={1}
                  className="text-muted-foreground text-[15px] md:text-base leading-relaxed max-w-md"
                >
                  WildAtlas scans Recreation.gov continuously — every few minutes, around the clock. The second a cancellation appears, you get an alert. No more refreshing. No more guesswork. Just a notification, a tap, and a booked permit.
                </motion.p>
              </div>

              {/* Right — iPhone mockup */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-center"
              >
                <div className="w-[300px] sm:w-[320px] md:w-[340px] mb-[-40px] md:mb-[-60px]">
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
                          <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
                          >
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
                          </motion.div>

                          {/* Subtle second notification hint — adds depth */}
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
              </motion.div>
            </motion.div>
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
                  className="flex gap-6 items-start"
                >
                  <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14">
                    <step.icon size={22} strokeWidth={1.8} className="text-primary mb-1" />
                    <span className="text-[10px] font-bold text-muted-foreground">{step.num}</span>
                  </div>
                  <div className="pt-1">
                    <h3 className="font-heading font-bold text-foreground text-[1.1rem] mb-1.5 tracking-tight">{step.title}</h3>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md">{step.desc}</p>
                  </div>
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
                className="relative bg-card border border-secondary/20 rounded-2xl p-6 sm:p-8 flex flex-col shadow-lg shadow-secondary/[0.06]"
              >
                <div className="absolute top-4 right-4 bg-secondary text-secondary-foreground text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                  Most Popular
                </div>
                <div className="mb-5">
                  <h3 className="text-2xl font-heading font-bold text-secondary">$9.99</h3>
                  <p className="text-[13px] text-muted-foreground mt-1">per month</p>
                </div>
                <div className="border-t border-border/60 pt-5 flex-1">
                  <ul className="space-y-3">
                    {["Unlimited permit trackers", "SMS + Email alerts", "Multi-park coverage", "Everything in Free"].map((f) => (
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
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-5 py-3 text-[14px] font-bold hover:brightness-110 transition-all shadow-md shadow-secondary/20 disabled:opacity-60"
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

        <section className="py-28 md:py-36">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-[1.75rem] md:text-[2.5rem] font-heading font-bold text-foreground mb-5 leading-tight tracking-tight"
              >
                Permits disappear in minutes.
                <br />
                <span className="text-secondary">Be ready in seconds.</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="text-muted-foreground text-base md:text-lg mb-12 max-w-md mx-auto leading-relaxed"
              >
                Join hikers who stopped refreshing Recreation.gov and started getting alerts.
              </motion.p>
              <motion.div variants={fadeUp} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2.5 bg-secondary text-secondary-foreground rounded-xl px-9 py-4.5 text-base font-bold hover:brightness-110 transition-all shadow-lg shadow-secondary/30"
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
            <div className="flex items-center gap-2.5">
              <Mountain size={16} className="text-primary" strokeWidth={2.2} />
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
