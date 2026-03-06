import { useEffect, useState, useRef } from "react";
import { ArrowRight, Mountain, Zap, Bell, Smartphone, Map, Search, MessageSquare, Radio } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import heroImage from "@/assets/yosemite-hero.jpg";

const PARKS_MONITORED = ["Yosemite", "Rainier", "Zion"];

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

  const ctaPath = user ? "/app" : "/auth?signup=true";
  const ctaLabel = user ? "Open App" : "Get Permit Alerts";
  const finalCtaLabel = user ? "Open App" : "Start Monitoring Permits — Free";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WildAtlas",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "WildAtlas monitors Recreation.gov every 2 minutes and texts you the instant a permit cancellation drops for national parks like Yosemite and Rainier.",
    url: "https://wildatlasnp.lovable.app",
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
        <link rel="canonical" href="https://wildatlasnp.lovable.app/" />
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
          {/* Background image with parallax */}
          <motion.div className="absolute inset-0 z-0 will-change-transform" style={{ y: heroY }}>
            <img
              src={heroImage}
              alt="Yosemite National Park valley at golden hour"
              className="w-full h-[120%] object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-background" />
          </motion.div>

          <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 pt-20 pb-36 md:pt-32 md:pb-48">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl"
            >
              {/* Now monitoring pill */}
              <div className="inline-flex items-center gap-2.5 bg-black/35 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 mb-10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-quiet opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-quiet" />
                </span>
                <span className="text-[10px] font-bold text-white/95 uppercase tracking-[0.18em]">
                  Now Monitoring
                </span>
                <span className="text-[10px] text-white/55 font-medium tracking-wide">
                  {PARKS_MONITORED.join(" · ")}
                </span>
              </div>

              <h1 className="text-[2.25rem] md:text-[3.75rem] font-heading font-bold text-white leading-[1.06] mb-6 drop-shadow-sm">
                Permits sell out in minutes.{" "}
                <span className="text-secondary">WildAtlas watches for you.</span>
              </h1>

              <p className="text-[15px] md:text-lg text-white/70 max-w-lg mb-12 font-body leading-relaxed">
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
                <p className="text-[12px] text-white/45 mt-3 font-medium">Free to start · No credit card required.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — SOCIAL PROOF / ACTIVITY
            ═══════════════════════════════════════════════════ */}
        <section className="relative z-10 -mt-14">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-card border border-border/70 rounded-2xl p-7 md:p-10 shadow-xl shadow-black/5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground text-center mb-7">
                Permit Activity
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
                {/* Permits captured — hero metric */}
                <div className="flex flex-col items-center text-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
                    <Bell size={22} strokeWidth={1.8} />
                  </div>
                  <span className="text-[2rem] md:text-4xl font-heading font-bold text-foreground leading-none tracking-tight">
                    {stats.found.toLocaleString()}
                  </span>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
                    Permits successfully captured
                  </p>
                </div>

                {/* Scans run */}
                <div className="flex flex-col items-center text-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Zap size={20} strokeWidth={1.8} />
                  </div>
                  <span className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-none tracking-tight">
                    {stats.scans.toLocaleString()}+
                  </span>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.15em]">
                    Scans run today
                  </p>
                </div>

                {/* Parks monitored */}
                <div className="flex flex-col items-center text-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Map size={20} strokeWidth={1.8} />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground leading-snug">
                    Monitoring {PARKS_MONITORED.join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    + Glacier, Rocky Mountain, Arches
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — BENEFITS
            ═══════════════════════════════════════════════════ */}
        <section className="py-24 md:py-32">
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
              className="grid sm:grid-cols-2 gap-5 md:gap-6"
            >
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={fadeUp}
                  custom={i + 2}
                  className="bg-card border border-border/70 rounded-2xl p-7 hover:shadow-lg hover:shadow-black/[0.04] transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <b.icon size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground text-[1.1rem] mb-2 tracking-tight">{b.title}</h3>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">{b.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" className="py-24 md:py-32 bg-muted/30">
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
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-md shadow-primary/20">
                    <step.icon size={18} strokeWidth={1.8} />
                    <span className="text-[10px] font-bold mt-0.5 opacity-80">{step.num}</span>
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
            SECTION 5 — FINAL CTA
            ═══════════════════════════════════════════════════ */}
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

        {/* ── Footer ── */}
        <footer className="border-t border-border/60 py-10 bg-background">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Mountain size={16} className="text-primary" strokeWidth={2.2} />
              <span className="font-heading font-bold text-foreground text-sm tracking-tight">WildAtlas</span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <span>© 2026 WildAtlas</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
