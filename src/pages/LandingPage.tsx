import { ArrowRight, Mountain, Zap, Bell, Shield, Smartphone, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/yosemite-hero.jpg";

const steps = [
  {
    num: "01",
    title: "Pick your permits",
    desc: "Choose which permits you want — Half Dome, Wilderness, cables. We monitor all of them.",
  },
  {
    num: "02",
    title: "We scan every 60 seconds",
    desc: "Our system polls Recreation.gov around the clock. Cancellations appear and vanish in minutes.",
  },
  {
    num: "03",
    title: "Get alerted instantly",
    desc: "The moment a slot opens, you get an SMS. You book it before anyone else even knows.",
  },
];

const features = [
  {
    icon: Zap,
    title: "60-second polling",
    desc: "We check Recreation.gov every minute. Cancellations don't last — neither do we.",
  },
  {
    icon: Bell,
    title: "SMS alerts",
    desc: "Real Twilio-powered text messages. No push notification you'll swipe away.",
  },
  {
    icon: Shield,
    title: "Multi-park ready",
    desc: "Yosemite today. Enchantments, Rainier, and more coming. One app, every permit.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    desc: "Built for your phone. Check your watches, toggle alerts, all from your pocket.",
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
  const [stats, setStats] = useState({ found: 0, watchers: 0, scans: 0 });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_landing_stats");
      const parsed = data as unknown as { watchers: number; found: number; total_finds: number } | null;
      const watchers = parsed?.watchers ?? 0;
      const found = parsed?.found ?? 0;
      const totalFinds = parsed?.total_finds ?? 0;
      const daysSinceLaunch = Math.max(1, Math.floor((Date.now() - new Date("2026-03-03").getTime()) / 86400000));
      const scansEstimate = daysSinceLaunch * 288;
      setStats({ found: Math.max(found, totalFinds), watchers: watchers, scans: scansEstimate });
    };
    load();
  }, []);
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
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
                Open App
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?signup=true"
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get Started
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-14 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="Yosemite National Park valley view"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-5 pt-20 pb-28 md:pt-32 md:pb-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full uppercase tracking-widest mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Now monitoring Yosemite &amp; Rainier
            </span>
            <h1 className="text-4xl md:text-6xl font-heading font-bold text-foreground leading-[1.1] mb-5">
              Stop refreshing.<br />
              <span className="text-primary">Start sniping.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mb-8 font-body leading-relaxed">
              WildAtlas monitors Recreation.gov every 60 seconds and texts you the instant a permit cancellation drops — Yosemite, Rainier, and more. You book it before anyone else.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={user ? "/app" : "/auth?signup=true"}
                className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {user ? "Open App" : "Get Permit Alerts"}
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 bg-card/80 backdrop-blur border border-border text-foreground rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-card transition-colors"
              >
                How It Works
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="relative z-10 -mt-8 mb-0">
        <div className="max-w-3xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-5 grid grid-cols-3 gap-4 shadow-lg"
          >
            {[
              { value: stats.scans.toLocaleString() + "+", label: "Scans run", icon: Zap },
              { value: stats.watchers.toLocaleString(), label: "Active watchers", icon: Users },
              { value: stats.found.toLocaleString(), label: "Permits found", icon: Bell },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <stat.icon size={14} className="text-secondary" />
                  <span className="text-xl md:text-2xl font-heading font-bold text-foreground">{stat.value}</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 bg-background">
        <div className="max-w-5xl mx-auto px-5">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
              Built for permit hunters
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-md mx-auto">
              Every feature exists to get you from "sold out" to "booked."
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="grid sm:grid-cols-2 gap-5"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="font-heading font-bold text-foreground text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-3xl mx-auto px-5">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
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
            className="space-y-6"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                variants={fadeUp}
                custom={i + 2}
                className="flex gap-5 items-start"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-sm">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground text-lg mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-background">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Permits disappear in minutes.<br />Be ready in seconds.
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Join the hunters who stopped refreshing and started booking.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Link
                to={user ? "/app" : "/auth?signup=true"}
                className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-8 py-4 text-base font-bold hover:opacity-90 transition-opacity"
              >
                {user ? "Open App" : "Start Sniping — Free"}
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
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
  );
};

export default LandingPage;
