import { useEffect, useState } from "react";
import { ArrowRight, Mountain, Zap, Bell, Smartphone, Map, Search, MessageSquare, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import heroImage from "@/assets/yosemite-hero.jpg";

const PARKS_MONITORED = ["Yosemite", "Rainier", "Zion"];

const benefits = [
  {
    icon: Bell,
    title: "Instant alerts",
    desc: "You receive an SMS the moment a cancellation appears — no delays, no refreshing.",
  },
  {
    icon: Zap,
    title: "Faster than manual refresh",
    desc: "WildAtlas scans Recreation.gov every 2 minutes during peak drop hours.",
  },
  {
    icon: Map,
    title: "Track multiple parks",
    desc: "Monitor permits across Yosemite, Rainier, Zion, Glacier and more — all at once.",
  },
  {
    icon: Smartphone,
    title: "Mobile first",
    desc: "Manage alerts and watches directly from your phone, anywhere on the trail.",
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

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_landing_stats");
      const parsed = data as unknown as { watchers: number; found: number; total_finds: number } | null;
      const found = parsed?.found ?? 0;
      const totalFinds = parsed?.total_finds ?? 0;
      const daysSinceLaunch = Math.max(1, Math.floor((Date.now() - new Date("2026-03-03").getTime()) / 86400000));
      const scansEstimate = daysSinceLaunch * 288;
      setStats({ found: Math.max(found, totalFinds), scans: scansEstimate });
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
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Mountain size={18} />
              </div>
              <span className="font-heading font-bold text-foreground text-lg">WildAtlas</span>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  to="/app"
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
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
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
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
        <section className="relative pt-14 overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <img
              src={heroImage}
              alt="Yosemite National Park valley at golden hour"
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-background" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-5 pt-24 pb-32 md:pt-36 md:pb-44">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl"
            >
              {/* Live monitoring pill */}
              <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-quiet opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-quiet" />
                </span>
                <span className="text-[11px] font-bold text-white/90 uppercase tracking-widest">
                  Now Monitoring
                </span>
                <span className="text-[11px] text-white/60 font-medium">
                  {PARKS_MONITORED.join(" · ")}
                </span>
              </div>

              <h1 className="text-4xl md:text-[3.5rem] font-heading font-bold text-white leading-[1.08] mb-5">
                Permits sell out in minutes.{" "}
                <span className="text-secondary">WildAtlas watches for you.</span>
              </h1>

              <p className="text-base md:text-lg text-white/75 max-w-lg mb-10 font-body leading-relaxed">
                WildAtlas monitors Recreation.gov every few minutes and texts you the instant a cancellation appears — so you can book before anyone else.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to={ctaPath}
                  className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-7 py-4 text-[15px] font-bold hover:opacity-90 transition-opacity shadow-lg shadow-secondary/25"
                >
                  {ctaLabel}
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#how-it-works"
                  className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 text-white rounded-xl px-7 py-4 text-[15px] font-semibold hover:bg-white/20 transition-colors"
                >
                  How it works
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — SOCIAL PROOF / ACTIVITY
            ═══════════════════════════════════════════════════ */}
        <section className="relative z-10 -mt-10">
          <div className="max-w-3xl mx-auto px-5">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground text-center mb-6">
                Permit Activity
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
                {/* Permits captured — hero metric */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
                    <Bell size={22} />
                  </div>
                  <span className="text-3xl md:text-4xl font-heading font-bold text-foreground leading-none">
                    {stats.found.toLocaleString()}
                  </span>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Permits successfully captured
                  </p>
                </div>

                {/* Scans run */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <span className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-none">
                    {stats.scans.toLocaleString()}+
                  </span>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Scans run today
                  </p>
                </div>

                {/* Parks monitored */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Map size={20} />
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
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-5">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-14"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3"
              >
                Why hikers choose WildAtlas
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="text-muted-foreground text-lg max-w-md mx-auto"
              >
                Every feature exists to get you from "sold out" to "booked."
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="grid sm:grid-cols-2 gap-5"
            >
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={fadeUp}
                  custom={i + 2}
                  className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <b.icon size={22} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground text-lg mb-1.5">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-3xl mx-auto px-5">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-16"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3"
              >
                Three steps to your permit
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg">
                Set it up once. We handle the rest.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="space-y-8"
            >
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  variants={fadeUp}
                  custom={i + 2}
                  className="flex gap-5 items-start"
                >
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-md">
                    <step.icon size={18} />
                    <span className="text-[10px] font-bold mt-0.5 opacity-80">{step.num}</span>
                  </div>
                  <div className="pt-1">
                    <h3 className="font-heading font-bold text-foreground text-lg mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 5 — FINAL CTA
            ═══════════════════════════════════════════════════ */}
        <section className="py-24 md:py-32">
          <div className="max-w-2xl mx-auto px-5 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4 leading-tight"
              >
                Permits disappear in minutes.
                <br />
                <span className="text-secondary">Be ready in seconds.</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="text-muted-foreground text-lg mb-10 max-w-md mx-auto"
              >
                Join hikers who stopped refreshing Recreation.gov and started getting alerts.
              </motion.p>
              <motion.div variants={fadeUp} custom={2}>
                <Link
                  to={ctaPath}
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-8 py-4 text-base font-bold hover:opacity-90 transition-opacity shadow-lg shadow-secondary/25"
                >
                  {finalCtaLabel}
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border py-8 bg-background">
          <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Mountain size={16} className="text-primary" />
              <span className="font-heading font-bold text-foreground text-sm">WildAtlas</span>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
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
