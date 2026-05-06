import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";
import { useProCtaIntent } from "@/hooks/useProCtaIntent";
import { useFleetActivity, formatRecency } from "@/hooks/useFleetActivity";
import { PARK_COLORS } from "@/lib/parks";
import halfDomeNight from "@/assets/landing-halfdome-night.jpg";
import "./landing.css";

/* ─────────────────────────────────────────────────────────────
 * WildAtlas — Landing v3 (Quiet Luxury, Lean)
 *
 * One page, six beats:
 *   1. Hero      — full-bleed photo, single headline, single primary CTA.
 *   2. Method    — Watch / Scan / Alert, three editorial cards.
 *   3. SMS demo  — what an alert looks like on your phone.
 *   4. Fleet     — the parks Poko watches, with live recency.
 *   5. Pricing   — Free vs. Pro, side by side, no comparison matrix.
 *   6. FAQ       — six honest questions.
 *   7. CTA       — closing push on Hero Green.
 *   8. Footer    — disclaimer + legal links.
 * ───────────────────────────────────────────────────────────── */

const INK = "#1A2F1E";
const CREAM = "#F0EDEA";
const HERO_GREEN = "#2F6F4E";
const GOLD = "#C9A96E";
const EASE = [0.16, 1, 0.3, 1] as const;

const LANDING_PARKS: Array<{ id: string; label: string; color: string }> = [
  { id: "yosemite",       label: "Yosemite",       color: PARK_COLORS.yosemite },
  { id: "zion",           label: "Zion",           color: PARK_COLORS.zion },
  { id: "glacier",        label: "Glacier",        color: PARK_COLORS.glacier },
  { id: "grand_canyon",   label: "Grand Canyon",   color: PARK_COLORS.grand_canyon },
  { id: "grand_teton",    label: "Grand Teton",    color: PARK_COLORS.grand_teton },
  { id: "arches",         label: "Arches",         color: PARK_COLORS.arches },
  { id: "rocky_mountain", label: "Rocky Mountain", color: PARK_COLORS.rocky_mountain },
  { id: "rainier",        label: "Mt. Rainier",    color: PARK_COLORS.rainier },
];
const LANDING_PARK_IDS = LANDING_PARKS.map((p) => p.id);

/* ───────── Reveal: scroll-triggered fade-up, single shot ───────── */
const Reveal = ({
  children,
  delay = 0,
  y = 20,
  className,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "section" | "article" | "header" | "p" | "ul" | "li";
}) => {
  const reduce = useReducedMotion();
  const M = motion[Tag] as typeof motion.div;
  return (
    <M
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: reduce ? 0.25 : 0.6, delay, ease: EASE }}
      className={className}
      style={style}
    >
      {children}
    </M>
  );
};

/* ───────── SectionLabel: small uppercase eyebrow ───────── */
const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 12,
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      color: "rgba(26, 47, 30, 0.5)",
    }}
  >
    {children}
  </div>
);

/* ───────── Display heading ───────── */
const Display = ({ children, size = 44, style }: { children: ReactNode; size?: number; style?: React.CSSProperties }) => (
  <h2
    style={{
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.08,
      letterSpacing: "-0.012em",
      color: INK,
      margin: 0,
      ...style,
    }}
  >
    {children}
  </h2>
);

const LandingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const proCta = useProCtaIntent();
  const ctaPath = user ? "/app" : "/auth?signup=true";
  const [proLoading, setProLoading] = useState(false);

  const fleet = useFleetActivity(LANDING_PARK_IDS);

  const trackCta = (event: string) => {
    try {
      posthog.capture(event, {
        source: "landing_page",
        variant: "lean_quiet_luxury_v3",
        device: isMobile ? "mobile" : "desktop",
        cta_intent: proCta.intent,
      });
    } catch { /* never block on analytics */ }
  };

  const handleProCheckout = async () => {
    const { destination, intent } = proCta;
    if (destination.kind === "navigate") {
      navigate(destination.path);
      return;
    }
    setProLoading(true);
    try {
      const fnName = destination.kind === "portal" ? "customer-portal" : "create-checkout";
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      if (data?.error === "already_subscribed") {
        toast({ title: "Already subscribed", description: "You're already a Pro member." });
        return;
      }
      if (data?.url) window.open(data.url, "_blank");
      else throw new Error(`No ${destination.kind} URL returned`);
    } catch (e) {
      console.error(`${intent} flow error:`, e);
      toast({
        title: "Trail hiccup",
        description: destination.kind === "portal"
          ? "Couldn't open the billing portal. Please try again."
          : "Couldn't start checkout. Please try again.",
      });
    } finally {
      setProLoading(false);
    }
  };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://wildatlas.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WildAtlas",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "WildAtlas watches Recreation.gov and texts you the moment a national park permit cancellation drops.",
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const horizPad = isMobile ? 20 : 40;
  const sectionPad = isMobile ? "72px 20px" : "112px 40px";

  return (
    <>
      <Helmet>
        <title>WildAtlas — National Park Permit Alerts</title>
        <meta
          name="description"
          content="WildAtlas watches Recreation.gov and texts you the instant a permit cancellation opens up. Yosemite, Rainier and 6 more."
        />
        <link rel="canonical" href={`${siteUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="landing-root min-h-screen" style={{ backgroundColor: CREAM }}>

        {/* ═══════════ NAV ═══════════ */}
        <nav
          className="sticky top-0 z-50"
          style={{
            background: "rgba(240, 237, 234, 0.92)",
            backdropFilter: "saturate(140%) blur(12px)",
            WebkitBackdropFilter: "saturate(140%) blur(12px)",
            borderBottom: "1px solid rgba(26, 47, 30, 0.10)",
          }}
        >
          <div
            className="mx-auto flex items-center justify-between"
            style={{ maxWidth: 1200, height: isMobile ? 60 : 72, padding: `0 ${horizPad}px` }}
          >
            <Link to="/" style={{ textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: isMobile ? 22 : 26,
                  fontWeight: 500,
                  color: INK,
                  letterSpacing: "-0.005em",
                }}
              >
                WildAtlas
              </span>
            </Link>
            <div className="flex items-center" style={{ gap: isMobile ? 16 : 28 }}>
              {!isMobile && (
                <a
                  href="#method"
                  style={navLinkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(26, 47, 30, 0.65)")}
                >
                  How it works
                </a>
              )}
              {!isMobile && (
                <a
                  href="#pricing"
                  style={navLinkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(26, 47, 30, 0.65)")}
                >
                  Pricing
                </a>
              )}
              <Link
                to={ctaPath}
                onClick={() => trackCta("landing_nav_start_clicked")}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  color: CREAM,
                  background: INK,
                  padding: "10px 18px",
                  borderRadius: 8,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HERO_GREEN)}
                onMouseLeave={(e) => (e.currentTarget.style.background = INK)}
              >
                {user ? "Open app" : "Start free"}
              </Link>
            </div>
          </div>
        </nav>

        {/* ═══════════ 1 · HERO ═══════════ */}
        <section
          aria-label="WildAtlas — permit alerts"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#0A1812",
            minHeight: isMobile ? "88svh" : "92vh",
            color: CREAM,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* image plate */}
          <div data-hero-image aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
            <div
              data-hero-image-inner
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${halfDomeNight})`,
                backgroundSize: "cover",
                backgroundPosition: isMobile ? "65% center" : "center 38%",
                willChange: "transform, opacity",
                animation:
                  "heroImageReveal 1600ms cubic-bezier(0.16, 1, 0.3, 1) both, heroKenBurns 32s ease-in-out 1600ms infinite",
              }}
            />
          </div>
          {/* scrim */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(10,24,18,0.55) 0%, rgba(10,24,18,0.25) 35%, rgba(10,24,18,0.55) 75%, rgba(10,24,18,0.85) 100%)",
              zIndex: 1,
            }}
          />

          <div
            className="mx-auto"
            style={{
              position: "relative",
              zIndex: 2,
              width: "100%",
              maxWidth: 920,
              padding: `0 ${horizPad}px`,
              textAlign: "center",
            }}
          >
            <Reveal delay={0.6}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  color: "rgba(240, 237, 234, 0.72)",
                  marginBottom: 28,
                }}
              >
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: GOLD, marginRight: 10, verticalAlign: "middle" }} />
                Watching Recreation.gov · 24 / 7
              </div>
            </Reveal>

            <Reveal delay={0.8}>
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: isMobile ? 44 : 76,
                  lineHeight: 1.02,
                  letterSpacing: "-0.018em",
                  color: CREAM,
                  margin: 0,
                  textShadow: "0 2px 30px rgba(0, 0, 0, 0.4)",
                }}
              >
                Permits sell out.<br />
                <em style={{ fontStyle: "italic", color: GOLD }}>Cancellations don't.</em>
              </h1>
            </Reveal>

            <Reveal delay={1.0}>
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: isMobile ? 18 : 22,
                  lineHeight: 1.5,
                  color: "rgba(240, 237, 234, 0.86)",
                  margin: "26px auto 0",
                  maxWidth: 560,
                }}
              >
                We watch Recreation.gov so you don't have to. The instant a permit drops, we text you.
              </p>
            </Reveal>

            <Reveal delay={1.2}>
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 14,
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 40,
                }}
              >
                <Link
                  to={ctaPath}
                  onClick={() => trackCta("landing_hero_cta_clicked")}
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 500,
                    color: INK,
                    background: CREAM,
                    padding: "16px 32px",
                    borderRadius: 8,
                    textDecoration: "none",
                    minWidth: isMobile ? 240 : 220,
                    textAlign: "center",
                    transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = CREAM; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {user ? "Open app" : "Start free — no card"}
                </Link>
                <a
                  href="#method"
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 17,
                    color: "rgba(240, 237, 234, 0.85)",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(240, 237, 234, 0.4)",
                    paddingBottom: 4,
                  }}
                >
                  See how it works →
                </a>
              </div>
            </Reveal>
          </div>

          {/* photo credit */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 16,
              right: horizPad,
              zIndex: 2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(240, 237, 234, 0.5)",
            }}
          >
            Half Dome · Yosemite
          </div>
        </section>

        {/* ═══════════ 2 · METHOD ═══════════ */}
        <section id="method" style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 1100 }}>
            <Reveal>
              <SectionLabel>The method</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <Display size={isMobile ? 36 : 52} style={{ marginTop: 16, maxWidth: 720 }}>
                Three steps. No refreshing. <em style={{ fontStyle: "italic", color: HERO_GREEN }}>No tabs.</em>
              </Display>
            </Reveal>

            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: isMobile ? 32 : 48,
              }}
            >
              {[
                {
                  num: "01",
                  title: "Watch a permit",
                  body: "Pick a permit you want — Half Dome cables, Wave, Subway, anything from Recreation.gov.",
                },
                {
                  num: "02",
                  title: "Poko scans",
                  body: "Our system polls Recreation.gov around the clock. Free scans every 5 minutes; Pro every 2.",
                },
                {
                  num: "03",
                  title: "You get the text",
                  body: "When availability drops, you get an SMS with a deep-link straight to checkout.",
                },
              ].map((step, i) => (
                <Reveal key={step.num} delay={0.1 + i * 0.08}>
                  <article style={{ borderTop: `1px solid ${INK}`, paddingTop: 20 }}>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        letterSpacing: "0.2em",
                        color: HERO_GREEN,
                        fontVariantNumeric: "tabular-nums",
                        marginBottom: 18,
                      }}
                    >
                      {step.num}
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 500,
                        fontSize: 26,
                        color: INK,
                        margin: 0,
                        marginBottom: 10,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "rgba(26, 47, 30, 0.75)",
                        margin: 0,
                      }}
                    >
                      {step.body}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 3 · SMS DEMO ═══════════ */}
        <section style={{ padding: sectionPad, background: "rgba(26, 47, 30, 0.03)" }}>
          <div
            className="mx-auto"
            style={{
              maxWidth: 1100,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? 48 : 80,
              alignItems: "center",
            }}
          >
            <div>
              <Reveal><SectionLabel>What you'll receive</SectionLabel></Reveal>
              <Reveal delay={0.05}>
                <Display size={isMobile ? 32 : 42} style={{ marginTop: 16 }}>
                  A single text. <em style={{ fontStyle: "italic", color: HERO_GREEN }}>Already booked.</em>
                </Display>
              </Reveal>
              <Reveal delay={0.1}>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontSize: 19,
                    lineHeight: 1.55,
                    color: "rgba(26, 47, 30, 0.75)",
                    marginTop: 24,
                    maxWidth: 460,
                  }}
                >
                  No app to open. No notification panic. The link drops you straight into the Recreation.gov checkout for that exact permit, on that exact date.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.15}>
              <SmsBubble />
            </Reveal>
          </div>
        </section>

        {/* ═══════════ 4 · FLEET ═══════════ */}
        <section style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 1100 }}>
            <Reveal><SectionLabel>The fleet</SectionLabel></Reveal>
            <Reveal delay={0.05}>
              <Display size={isMobile ? 32 : 44} style={{ marginTop: 16, maxWidth: 640 }}>
                Eight parks. <em style={{ fontStyle: "italic", color: HERO_GREEN }}>One quiet watch.</em>
              </Display>
            </Reveal>

            <div
              style={{
                marginTop: 48,
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: isMobile ? 20 : 28,
              }}
            >
              {LANDING_PARKS.map((p, i) => {
                const lastAlertAt = fleet.byPark[p.id]?.lastAlertAt ?? null;
                const recency = formatRecency(lastAlertAt);
                const isQuiet = recency.startsWith("QUIET") || recency === "STANDING BY";
                return (
                  <Reveal key={p.id} delay={0.05 + i * 0.04}>
                    <div style={{ borderTop: `1px solid rgba(26, 47, 30, 0.18)`, paddingTop: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                        <h3
                          style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: 19,
                            fontWeight: 500,
                            color: INK,
                            margin: 0,
                          }}
                        >
                          {p.label}
                        </h3>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 11,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: isQuiet ? "rgba(26, 47, 30, 0.4)" : HERO_GREEN,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fleet.loading ? "…" : recency}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={0.4}>
              <p
                style={{
                  marginTop: 40,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "rgba(26, 47, 30, 0.55)",
                  textAlign: "center",
                }}
              >
                {fleet.globalLastAlertAt
                  ? `Last cancellation caught ${formatRecency(fleet.globalLastAlertAt).replace(/^ALERTED\s+/, "").replace(/\s+AGO$/, "").toLowerCase()} ago.`
                  : "Live status updates every few minutes."}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ═══════════ 5 · PRICING ═══════════ */}
        <section id="pricing" style={{ padding: sectionPad, background: "rgba(26, 47, 30, 0.03)" }}>
          <div className="mx-auto" style={{ maxWidth: 1100 }}>
            <Reveal><SectionLabel>Pricing</SectionLabel></Reveal>
            <Reveal delay={0.05}>
              <Display size={isMobile ? 36 : 52} style={{ marginTop: 16, textAlign: "center", marginInline: "auto", maxWidth: 720 }}>
                Two plans. <em style={{ fontStyle: "italic", color: HERO_GREEN }}>One gets you in faster.</em>
              </Display>
            </Reveal>

            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: isMobile ? 20 : 28,
                maxWidth: 880,
                marginInline: "auto",
              }}
            >
              {/* FREE */}
              <Reveal delay={0.1}>
                <PlanCard
                  tone="free"
                  title="Free"
                  price="$0"
                  cadence="forever"
                  hook="One permit watch. Email alerts. The whole fleet."
                  perks={[
                    "1 permit watch",
                    "Scan every 5 minutes",
                    "Email alerts",
                    "All 8 parks",
                    "Poko AI guide",
                  ]}
                  cta={
                    <Link
                      to={ctaPath}
                      onClick={() => trackCta("landing_pricing_free_cta_clicked")}
                      style={{
                        ...planCtaBase,
                        background: "transparent",
                        color: INK,
                        border: `1px solid ${INK}`,
                      }}
                    >
                      Start free
                    </Link>
                  }
                />
              </Reveal>

              {/* PRO */}
              <Reveal delay={0.18}>
                <PlanCard
                  tone="pro"
                  title="Pro"
                  price="$9"
                  cadence="/ month"
                  hook="Faster scans, more permits, SMS the second a window opens."
                  badge="Recommended"
                  perks={[
                    "20 permit watches",
                    "Scan every 2 minutes",
                    "SMS + email alerts",
                    "Priority queue at peak hours",
                    "Cancel anytime",
                  ]}
                  cta={
                    <button
                      type="button"
                      onClick={() => { trackCta("landing_pricing_pro_cta_clicked"); handleProCheckout(); }}
                      disabled={proLoading}
                      style={{
                        ...planCtaBase,
                        background: HERO_GREEN,
                        color: CREAM,
                        border: "none",
                        cursor: proLoading ? "wait" : "pointer",
                        opacity: proLoading ? 0.7 : 1,
                      }}
                    >
                      {proLoading ? <Loader2 className="inline animate-spin" size={16} /> : proCta.label}
                    </button>
                  }
                />
              </Reveal>
            </div>

            <Reveal delay={0.3}>
              <p
                style={{
                  marginTop: 28,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "rgba(26, 47, 30, 0.55)",
                  textAlign: "center",
                }}
              >
                Both plans include Poko, our AI park guide. Pro just gets there first.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ═══════════ 6 · FAQ ═══════════ */}
        <section style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 760 }}>
            <Reveal><SectionLabel>Honest questions</SectionLabel></Reveal>
            <Reveal delay={0.05}>
              <Display size={isMobile ? 30 : 40} style={{ marginTop: 16 }}>
                The fine print, said plainly.
              </Display>
            </Reveal>
            <div style={{ marginTop: 40 }}>
              {[
                {
                  q: "Are you affiliated with Recreation.gov or the National Park Service?",
                  a: "No. WildAtlas is independent. We watch the public Recreation.gov availability data and notify you when something changes.",
                },
                {
                  q: "Do you book the permit for me?",
                  a: "No — that part stays in your hands. We send you a deep link straight to the Recreation.gov checkout page so you can grab it before someone else does.",
                },
                {
                  q: "How fast will I get the alert?",
                  a: "On Free, we scan every 5 minutes. On Pro, every 2 minutes. SMS delivery is typically under 30 seconds after we detect availability.",
                },
                {
                  q: "What parks do you watch?",
                  a: "Yosemite, Zion, Glacier, Grand Canyon, Grand Teton, Arches, Rocky Mountain, and Mt. Rainier. More on the way.",
                },
                {
                  q: "Can I cancel Pro anytime?",
                  a: "Yes. One click in Settings, no email required. You'll keep Pro until the end of the billing period.",
                },
                {
                  q: "Will I get spammed with texts?",
                  a: "Only when one of your watched permits opens up. That's the whole product. You can disable SMS per permit in the app at any time.",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={0.05 + i * 0.04}>
                  <FaqRow q={item.q} a={item.a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 7 · CLOSING CTA ═══════════ */}
        <section
          style={{
            padding: isMobile ? "80px 20px" : "120px 40px",
            background: HERO_GREEN,
            color: CREAM,
            textAlign: "center",
          }}
        >
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            <Reveal>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: isMobile ? 38 : 56,
                  lineHeight: 1.05,
                  letterSpacing: "-0.014em",
                  color: CREAM,
                  margin: 0,
                }}
              >
                Sleep through the cancellations.<br />
                <em style={{ fontStyle: "italic", color: GOLD }}>We'll wake you for the right ones.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <Link
                to={ctaPath}
                onClick={() => trackCta("landing_closing_cta_clicked")}
                style={{
                  display: "inline-block",
                  marginTop: 36,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 500,
                  color: HERO_GREEN,
                  background: CREAM,
                  padding: "16px 36px",
                  borderRadius: 12,
                  textDecoration: "none",
                  transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {user ? "Open app" : "Start free — no card required"}
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer style={{ padding: isMobile ? "48px 20px 32px" : "64px 40px 40px", borderTop: "1px solid rgba(26, 47, 30, 0.10)" }}>
          <div
            className="mx-auto"
            style={{
              maxWidth: 1100,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr",
              gap: isMobile ? 32 : 48,
            }}
          >
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: INK, marginBottom: 12 }}>
                WildAtlas
              </div>
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "rgba(26, 47, 30, 0.6)",
                  margin: 0,
                  maxWidth: 360,
                }}
              >
                An independent watch on Recreation.gov — kept for travelers who'd rather sleep than refresh.
              </p>
              <p
                style={{
                  marginTop: 16,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: "rgba(26, 47, 30, 0.45)",
                }}
              >
                Not affiliated with the National Park Service or Recreation.gov.
              </p>
            </div>

            <FooterColumn
              label="Navigate"
              items={[
                { href: "#method", label: "How it works" },
                { href: "#pricing", label: "Pricing" },
                { href: ctaPath, label: "Start free", to: true },
              ]}
            />
            <FooterColumn
              label="Legal"
              items={[
                { href: "/terms", label: "Terms", to: true },
                { href: "/privacy", label: "Privacy", to: true },
              ]}
            />
          </div>
          <div
            className="mx-auto"
            style={{
              maxWidth: 1100,
              marginTop: 48,
              paddingTop: 20,
              borderTop: "1px solid rgba(26, 47, 30, 0.08)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(26, 47, 30, 0.5)",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>© {new Date().getFullYear()} WildAtlas</span>
            <span>Made for the trail.</span>
          </div>
        </footer>

      </div>
    </>
  );
};

/* ───────── nav link style ───────── */
const navLinkStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  letterSpacing: "0.04em",
  color: "rgba(26, 47, 30, 0.65)",
  textDecoration: "none",
  transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
};

/* ───────── Plan card ───────── */
const planCtaBase: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  fontWeight: 500,
  padding: "14px 20px",
  borderRadius: 10,
  textDecoration: "none",
  textAlign: "center",
  transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
};

const PlanCard = ({
  tone,
  title,
  price,
  cadence,
  hook,
  perks,
  cta,
  badge,
}: {
  tone: "free" | "pro";
  title: string;
  price: string;
  cadence: string;
  hook: string;
  perks: string[];
  cta: ReactNode;
  badge?: string;
}) => {
  const isPro = tone === "pro";
  return (
    <article
      style={{
        position: "relative",
        background: CREAM,
        border: isPro ? `1.5px solid ${HERO_GREEN}` : `1px solid rgba(26, 47, 30, 0.14)`,
        borderRadius: 14,
        padding: 32,
        boxShadow: isPro ? "0 12px 40px -16px rgba(47, 111, 78, 0.28)" : "0 4px 20px -12px rgba(26, 47, 30, 0.12)",
      }}
    >
      {badge && (
        <div
          style={{
            position: "absolute",
            top: -12,
            right: 24,
            background: HERO_GREEN,
            color: CREAM,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "5px 12px",
            borderRadius: 999,
          }}
        >
          {badge}
        </div>
      )}
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: isPro ? HERO_GREEN : "rgba(26, 47, 30, 0.5)",
          marginBottom: 18,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 56,
            fontWeight: 500,
            lineHeight: 1,
            color: INK,
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "rgba(26, 47, 30, 0.55)",
          }}
        >
          {cadence}
        </span>
      </div>
      <p
        style={{
          marginTop: 16,
          marginBottom: 24,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: "italic",
          fontSize: 17,
          lineHeight: 1.4,
          color: "rgba(26, 47, 30, 0.7)",
        }}
      >
        {hook}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 28 }}>
        {perks.map((p) => (
          <li
            key={p}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: INK,
              padding: "8px 0",
              borderBottom: "1px solid rgba(26, 47, 30, 0.06)",
            }}
          >
            <span aria-hidden="true" style={{ color: isPro ? HERO_GREEN : "rgba(26, 47, 30, 0.4)" }}>✓</span>
            {p}
          </li>
        ))}
      </ul>
      {cta}
    </article>
  );
};

/* ───────── FAQ row ───────── */
const FaqRow = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(26, 47, 30, 0.12)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "20px 0",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          minHeight: 44,
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20,
            fontWeight: 500,
            color: INK,
            lineHeight: 1.3,
          }}
        >
          {q}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 20,
            color: HERO_GREEN,
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          +
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ overflow: "hidden" }}
      >
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            color: "rgba(26, 47, 30, 0.7)",
            margin: 0,
            paddingBottom: 24,
            paddingRight: 32,
          }}
        >
          {a}
        </p>
      </motion.div>
    </div>
  );
};

/* ───────── SMS bubble ───────── */
const SmsBubble = () => {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAge((a) => (a >= 9 ? 0 : a + 1)), 30_000);
    return () => clearInterval(id);
  }, []);
  const ageLabel = age === 0 ? "now" : `${age} min ago`;

  return (
    <div
      style={{
        background: "#1A2F1E",
        borderRadius: 28,
        padding: 28,
        boxShadow: "0 30px 60px -20px rgba(26, 47, 30, 0.35)",
        maxWidth: 420,
        marginInline: "auto",
        width: "100%",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(240, 237, 234, 0.5)",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        WildAtlas · {ageLabel}
      </div>
      <div
        style={{
          background: "#3A8E68",
          color: "#FFFFFF",
          borderRadius: 22,
          padding: "14px 18px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          lineHeight: 1.45,
          maxWidth: "90%",
        }}
      >
        🏕️ Half Dome cables · Jul 14 — 2 spots opened. Tap to grab:<br />
        <span style={{ color: "rgba(255,255,255,0.85)", textDecoration: "underline" }}>
          rec.gov/r/halfdome
        </span>
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: "rgba(240, 237, 234, 0.4)",
          textAlign: "right",
        }}
      >
        Delivered
      </div>
    </div>
  );
};

/* ───────── Footer column ───────── */
const FooterColumn = ({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string; to?: boolean }>;
}) => (
  <div>
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(26, 47, 30, 0.5)",
        marginBottom: 16,
      }}
    >
      {label}
    </div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => {
        const sx: React.CSSProperties = {
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 16,
          color: INK,
          textDecoration: "none",
          transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        };
        return (
          <li key={item.href}>
            {item.to ? (
              <Link to={item.href} style={sx}>{item.label}</Link>
            ) : (
              <a href={item.href} style={sx}>{item.label}</a>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

export default LandingPage;
