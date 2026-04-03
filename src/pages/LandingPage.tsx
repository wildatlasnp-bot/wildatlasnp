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
    desc: "Scans Recreation.gov every 2 minutes — day and night.",
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

const HERO_PARKS = [
  { key: "halfdome", label: "Half Dome" },
  { key: "zion", label: "Zion" },
  { key: "glacier", label: "Glacier" },
  { key: "grandcanyon", label: "Grand Canyon" },
  { key: "grandteton", label: "Grand Teton" },
  { key: "rockymtn", label: "Rocky Mtn" },
  { key: "arches", label: "Arches" },
  { key: "rainier", label: "Rainier" },
];

const LandingPage = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ found: 0, scans: 0 });
  const heroRef = useRef<HTMLElement>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [selectedPark, setSelectedPark] = useState("halfdome");

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

  const ctaPath = user ? "/app" : "/auth?signup=true";
  const selectedParkLabel = HERO_PARKS.find(p => p.key === selectedPark)?.label ?? "Half Dome";
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
          className="hero-anim-nav fixed top-0 left-0 right-0 z-50 transition-all duration-300"
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

            {/* Mobile: green dot only | Desktop: full pill */}
            {isMobile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, background: "#2F6F4E", borderRadius: "50%" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "#2F6F4E", fontFamily: "'DM Sans', sans-serif" }}>Scanning now</span>
              </div>
            ) : (
              <div
                style={{
                  background: navScrolled ? "#fff" : "rgba(255,255,255,0.15)",
                  border: navScrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 30,
                  padding: "5px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  maxWidth: 110,
                  overflow: "hidden",
                  transition: "background 0.3s, border 0.3s",
                }}
              >
                <div style={{ width: 6, height: 6, background: "#4ADE80", borderRadius: "50%", boxShadow: "0 0 4px #4ADE80", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: navScrolled ? "#2F6F4E" : "#fff", whiteSpace: "nowrap" as const, overflow: "hidden", transition: "color 0.3s" }}>
                  • 8 parks live
                </span>
              </div>
            )}

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

        {/* Park selector pills */}
        <div style={{ background: "#F0EDEA", paddingTop: 68 }}>
          <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none" as const, msOverflowStyle: "none" as any, WebkitOverflowScrolling: "touch" }}>
            <style>{`.park-pills-row::-webkit-scrollbar { display: none; }`}</style>
            {HERO_PARKS.map(p => (
              <button
                key={p.key}
                onClick={() => setSelectedPark(p.key)}
                style={{
                  fontSize: 11,
                  padding: "5px 11px",
                  borderRadius: 100,
                  border: selectedPark === p.key ? "0.5px solid #2F6F4E" : "0.5px solid rgba(0,0,0,0.15)",
                  background: selectedPark === p.key ? "#2F6F4E" : "transparent",
                  color: selectedPark === p.key ? "#fff" : "#6B6A64",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", background: "#F0EDEA" }}>
            {[
              { value: "1,247", label: "Permits found" },
              { value: "8", label: "Parks watched" },
              { value: "2 min", label: "Scan interval" },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, textAlign: "center" as const, padding: "10px 0", borderLeft: i > 0 ? "0.5px solid rgba(0,0,0,0.1)" : "none" }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: "#2F6F4E" }}>{s.value}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#9a9a9a", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

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
                width: 72,
                marginBottom: 32,
                filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.35))",
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
                {selectedParkLabel} is yours to take.
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
              {user ? "Open App →" : `Watch ${selectedParkLabel} now — it's free →`}
            </Link>

            {/* Trust line */}
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 12 }}>
              Free forever · No credit card · Cancel anytime
            </p>
          </div>

          {/* Live scan count strip */}
          {(() => {
            const recentFindsCount = 3;
            const recentFindsWindow = "6 hours";
            return (
              <div style={{ background: "#F0EDEA", padding: "10px 18px", textAlign: "center" as const }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#6B6A64", lineHeight: 1, margin: 0 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#2F6F4E", marginRight: 6, verticalAlign: "middle" }} />
                  {recentFindsCount} {selectedParkLabel} permits found in the last {recentFindsWindow}
                </p>
              </div>
            );
          })()}
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — ALERT CARD
            ═══════════════════════════════════════════════════ */}
        <section style={{ padding: "60px 24px", background: "#F0EDEA" }}>
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" as const }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#9a9a9a", marginBottom: 20, textTransform: "uppercase" as const }}>
              What you'll receive
            </p>
            <div style={{ maxWidth: 360, width: "calc(100% - 48px)", margin: "0 auto", background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 20px rgba(0,0,0,0.08)" }}>
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
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontStyle: "italic", color: "#9a9a9a", marginTop: 12 }}>
              Real alerts look exactly like this — SMS on Pro, email on Free
            </p>
          </div>
          <style>{`@keyframes alertPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } }`}</style>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — TESTIMONIAL
            ═══════════════════════════════════════════════════ */}
        <section style={{ padding: "60px 24px", background: "#F0EDEA" }}>
          <div style={{ maxWidth: 448, margin: "0 auto", textAlign: "center" as const }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#9a9a9a", marginBottom: 32, textTransform: "uppercase" as const }}>
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
                    {step.num === "02" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FAEEDA", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
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
