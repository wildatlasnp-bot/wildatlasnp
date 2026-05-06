import { useEffect, useState, type ReactNode } from "react";
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

/* ════════════════════════════════════════════════════════════════════
 * WildAtlas — Landing v4 (Editorial)
 *
 * The page is composed like a single-issue field journal: masthead with
 * issue date, Roman-numeral chapters, hairline ornaments with diamond
 * glyphs, a drop-capped lede, marginalia in italic Cormorant, an
 * iMessage-faithful SMS bubble, a "private club" Pro card in gold trim,
 * and a colophon footer that names the type. Nothing here is generic.
 * ════════════════════════════════════════════════════════════════════ */

const INK         = "#1A2F1E";          // deep forest
const INK_SOFT    = "rgba(26, 47, 30, 0.62)";
const INK_HAIR    = "rgba(26, 47, 30, 0.16)";
const INK_FAINT   = "rgba(26, 47, 30, 0.08)";
const CREAM       = "#F0EDEA";
const CREAM_WARM  = "#E9E4DD";          // pricing band
const HERO_GREEN  = "#2F6F4E";
const GOLD        = "#B58A3F";          // burnished, not yellow
const GOLD_SOFT   = "rgba(181, 138, 63, 0.18)";

const SERIF = "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const SANS  = "'DM Sans', 'Inter', -apple-system, sans-serif";
const MONO  = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace";

const EASE  = [0.16, 1, 0.3, 1] as const;

const LANDING_PARKS: Array<{ id: string; label: string; coords: string; color: string }> = [
  { id: "yosemite",       label: "Yosemite",       coords: "37.8651° N",  color: PARK_COLORS.yosemite },
  { id: "zion",           label: "Zion",           coords: "37.2982° N",  color: PARK_COLORS.zion },
  { id: "glacier",        label: "Glacier",        coords: "48.6960° N",  color: PARK_COLORS.glacier },
  { id: "grand_canyon",   label: "Grand Canyon",   coords: "36.0544° N",  color: PARK_COLORS.grand_canyon },
  { id: "grand_teton",    label: "Grand Teton",    coords: "43.7904° N",  color: PARK_COLORS.grand_teton },
  { id: "arches",         label: "Arches",         coords: "38.7331° N",  color: PARK_COLORS.arches },
  { id: "rocky_mountain", label: "Rocky Mountain", coords: "40.3428° N",  color: PARK_COLORS.rocky_mountain },
  { id: "rainier",        label: "Mt. Rainier",    coords: "46.8523° N",  color: PARK_COLORS.rainier },
];
const LANDING_PARK_IDS = LANDING_PARKS.map((p) => p.id);

/* ───── Roman numeral helper for chapter heads ───── */
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/* ───── Reveal: scroll fade-up, once ───── */
const Reveal = ({
  children,
  delay = 0,
  y = 18,
  className,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "section" | "article" | "header" | "p" | "ul" | "li" | "h2" | "h3";
}) => {
  const reduce = useReducedMotion();
  const M = motion[Tag] as typeof motion.div;
  return (
    <M
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: reduce ? 0.25 : 0.7, delay, ease: EASE }}
      className={className}
      style={style}
    >
      {children}
    </M>
  );
};

/* ───── Diamond-glyph ornament rule ─────
   ── ◆ ── used as section divider; gold thread, cream field. */
const Ornament = ({ tone = "ink" }: { tone?: "ink" | "cream" }) => {
  const line = tone === "cream" ? "rgba(240, 237, 234, 0.32)" : "rgba(26, 47, 30, 0.22)";
  const glyph = tone === "cream" ? GOLD : GOLD;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        margin: "0 auto",
        maxWidth: 220,
      }}
    >
      <span style={{ flex: 1, height: 1, background: line }} />
      <span
        style={{
          color: glyph,
          fontFamily: SERIF,
          fontSize: 11,
          letterSpacing: "0.4em",
          transform: "translateY(-1px)",
        }}
      >
        ◆
      </span>
      <span style={{ flex: 1, height: 1, background: line }} />
    </div>
  );
};

/* ───── ChapterHead: roman numeral + small label + huge serif title ───── */
const ChapterHead = ({
  numeral,
  label,
  title,
  italic,
  align = "left",
  isMobile,
}: {
  numeral: string;
  label: string;
  title: string;
  italic?: string;
  align?: "left" | "center";
  isMobile: boolean;
}) => (
  <div style={{ textAlign: align }}>
    <Reveal>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          fontFamily: SANS,
          fontSize: 11,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: INK_SOFT,
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 14,
            letterSpacing: "0.05em",
            color: GOLD,
            textTransform: "none",
          }}
        >
          № {numeral}
        </span>
        <span style={{ width: 24, height: 1, background: GOLD, opacity: 0.55 }} />
        <span>{label}</span>
      </div>
    </Reveal>
    <Reveal delay={0.05}>
      <h2
        style={{
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: isMobile ? 38 : 60,
          lineHeight: 1.02,
          letterSpacing: "-0.018em",
          color: INK,
          margin: "20px 0 0",
        }}
      >
        {title}
        {italic && (
          <>
            <br />
            <em style={{ fontStyle: "italic", color: HERO_GREEN }}>{italic}</em>
          </>
        )}
      </h2>
    </Reveal>
  </div>
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
        variant: "editorial_v4_2026_05",
        device: isMobile ? "mobile" : "desktop",
        cta_intent: proCta.intent,
      });
    } catch { /* analytics never blocks navigation */ }
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

  // Issue date for the masthead — formatted as "VOL. I · ISSUE LXXXII"-style stamp
  const today = new Date();
  const issueDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const editionNo = String(Math.floor((today.getTime() / (1000 * 60 * 60 * 24)) % 999)).padStart(3, "0");

  const horizPad = isMobile ? 22 : 56;
  const sectionPad = isMobile ? "88px 22px" : "144px 56px";

  return (
    <>
      <Helmet>
        <title>WildAtlas — National Park Permit Alerts</title>
        <meta
          name="description"
          content="An independent watch on Recreation.gov. WildAtlas texts you the instant a permit cancellation opens at Yosemite, Rainier and six more parks."
        />
        <link rel="canonical" href={`${siteUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="landing-root min-h-screen" style={{ backgroundColor: CREAM }}>

        {/* ════════════════════ MASTHEAD ════════════════════
            A true newspaper-style top: edition stamp on the left, wordmark
            centered, single CTA on the right. Hairline rules, gold thread
            beneath. Sticky but slim. */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(240, 237, 234, 0.94)",
            backdropFilter: "saturate(140%) blur(14px)",
            WebkitBackdropFilter: "saturate(140%) blur(14px)",
            borderBottom: `1px solid ${INK_HAIR}`,
          }}
        >
          {/* gold thread */}
          <div aria-hidden style={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${GOLD} 35%, ${GOLD} 65%, transparent 100%)`, opacity: 0.45 }} />

          <div
            className="mx-auto"
            style={{
              maxWidth: 1280,
              padding: `0 ${horizPad}px`,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr auto" : "1fr auto 1fr",
              alignItems: "center",
              minHeight: isMobile ? 60 : 78,
              gap: 16,
            }}
          >
            {/* LEFT — edition stamp */}
            {!isMobile && (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: INK_SOFT,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                Vol. I · No. {editionNo} <span style={{ margin: "0 8px", color: INK_HAIR }}>|</span> {issueDate}
              </div>
            )}

            {/* CENTER — wordmark */}
            <Link
              to="/"
              style={{
                textDecoration: "none",
                textAlign: isMobile ? "left" : "center",
                lineHeight: 1,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: isMobile ? 24 : 30,
                  color: INK,
                  letterSpacing: "0.005em",
                }}
              >
                WildAtlas
              </div>
              {!isMobile && (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: 11.5,
                    color: GOLD,
                    letterSpacing: "0.04em",
                  }}
                >
                  — A field journal of cancellations —
                </div>
              )}
            </Link>

            {/* RIGHT — CTA */}
            <div style={{ justifySelf: isMobile ? "end" : "end", display: "flex", alignItems: "center", gap: 18 }}>
              {!isMobile && (
                <a
                  href="#chapter-ii"
                  style={mastheadLinkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK_SOFT)}
                >
                  The Method
                </a>
              )}
              {!isMobile && (
                <a
                  href="#chapter-v"
                  style={mastheadLinkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK_SOFT)}
                >
                  Membership
                </a>
              )}
              <Link
                to={ctaPath}
                onClick={() => trackCta("landing_nav_start_clicked")}
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: isMobile ? 15 : 17,
                  color: INK,
                  textDecoration: "none",
                  paddingBottom: 3,
                  borderBottom: `1px solid ${INK}`,
                  whiteSpace: "nowrap",
                }}
              >
                {user ? "Open" : "Subscribe"} →
              </Link>
            </div>
          </div>
        </header>

        {/* ════════════════════ I · CINEMATIC HERO ════════════════════
            Full-bleed Half Dome under moonlight. Gold issue stamp top-left.
            Editorial caption block bottom-left. Center: a single, magisterial
            line in display serif, with italic gold pickup. */}
        <section
          aria-label="WildAtlas — permit cancellations, watched"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#0A1812",
            minHeight: isMobile ? "92svh" : "100vh",
            color: CREAM,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* image plate */}
          <div data-hero-image aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
            <div
              data-hero-image-inner
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${halfDomeNight})`,
                backgroundSize: "cover",
                backgroundPosition: isMobile ? "62% center" : "center 38%",
                willChange: "transform, opacity",
                animation:
                  "heroImageReveal 1800ms cubic-bezier(0.16, 1, 0.3, 1) both, heroKenBurns 36s ease-in-out 1800ms infinite",
              }}
            />
          </div>

          {/* film grain — barely-there texture for paper-like depth */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              opacity: 0.08,
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />

          {/* scrim */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              background:
                "linear-gradient(180deg, rgba(10,24,18,0.7) 0%, rgba(10,24,18,0.3) 28%, rgba(10,24,18,0.55) 72%, rgba(10,24,18,0.92) 100%)",
            }}
          />

          {/* TOP-LEFT — gold issue stamp */}
          <div
            style={{
              position: "absolute",
              top: isMobile ? 22 : 36,
              left: horizPad,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "rgba(240, 237, 234, 0.78)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, boxShadow: `0 0 12px ${GOLD}` }} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Live · Watching Recreation.gov
            </span>
          </div>

          {/* TOP-RIGHT — coordinates of the photograph */}
          <div
            style={{
              position: "absolute",
              top: isMobile ? 22 : 36,
              right: horizPad,
              zIndex: 3,
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(240, 237, 234, 0.55)",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            37.7459° N{!isMobile && <><br />119.5332° W</>}
          </div>

          {/* CENTER content */}
          <div
            className="mx-auto"
            style={{
              position: "relative",
              zIndex: 4,
              width: "100%",
              maxWidth: 980,
              padding: `0 ${horizPad}px`,
              textAlign: "center",
            }}
          >
            <Reveal delay={0.7}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 11,
                  letterSpacing: "0.42em",
                  textTransform: "uppercase",
                  color: GOLD,
                  marginBottom: 28,
                }}
              >
                Chapter I
              </div>
            </Reveal>

            <Reveal delay={0.9} y={28}>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontWeight: 400,
                  fontSize: isMobile ? 48 : 92,
                  lineHeight: 1.0,
                  letterSpacing: "-0.024em",
                  color: CREAM,
                  margin: 0,
                  textShadow: "0 2px 40px rgba(0, 0, 0, 0.45)",
                }}
              >
                Permits sell out.
                <br />
                <em
                  style={{
                    fontStyle: "italic",
                    color: GOLD,
                    fontWeight: 400,
                  }}
                >
                  Cancellations don't.
                </em>
              </h1>
            </Reveal>

            <Reveal delay={1.1}>
              <div
                style={{
                  margin: "36px auto 0",
                  width: 64,
                  height: 1,
                  background: GOLD,
                  opacity: 0.6,
                }}
              />
            </Reveal>

            <Reveal delay={1.2}>
              <p
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: isMobile ? 19 : 24,
                  lineHeight: 1.5,
                  color: "rgba(240, 237, 234, 0.92)",
                  margin: "28px auto 0",
                  maxWidth: 620,
                  fontWeight: 400,
                }}
              >
                We watch Recreation.gov so you can sleep through it.<br />
                The instant a permit drops, your phone — and only your phone — knows.
              </p>
            </Reveal>

            <Reveal delay={1.4}>
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? 18 : 28,
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 48,
                }}
              >
                <Link
                  to={ctaPath}
                  onClick={() => trackCta("landing_hero_cta_clicked")}
                  style={{
                    fontFamily: SANS,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: INK,
                    background: CREAM,
                    padding: "18px 36px",
                    borderRadius: 2,
                    textDecoration: "none",
                    minWidth: isMobile ? 260 : 240,
                    textAlign: "center",
                    boxShadow: "0 18px 40px -16px rgba(0,0,0,0.5)",
                    transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 24px 48px -16px rgba(0,0,0,0.55)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 18px 40px -16px rgba(0,0,0,0.5)";
                  }}
                >
                  {user ? "Open the journal" : "Begin the watch"}
                </Link>
                <a
                  href="#chapter-ii"
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: 18,
                    color: "rgba(240, 237, 234, 0.85)",
                    textDecoration: "none",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(240, 237, 234, 0.45)",
                    transition: "border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = GOLD; e.currentTarget.style.borderColor = GOLD; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(240, 237, 234, 0.85)"; e.currentTarget.style.borderColor = "rgba(240, 237, 234, 0.45)"; }}
                >
                  read the method ↓
                </a>
              </div>
            </Reveal>
          </div>

          {/* BOTTOM — caption strip, like a newspaper photo cutline */}
          <div
            style={{
              position: "absolute",
              left: horizPad,
              right: horizPad,
              bottom: isMobile ? 22 : 32,
              zIndex: 3,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              color: "rgba(240, 237, 234, 0.6)",
              fontFamily: SANS,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <span>
              {isMobile ? "Half Dome · 02:14 PDT" : "Plate I — Half Dome under moonlight, 02:14 PDT"}
            </span>
            {!isMobile && (
              <span style={{ fontFamily: SERIF, fontStyle: "italic", textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
                The hour permits return.
              </span>
            )}
          </div>
        </section>

        {/* ════════════════════ II · THE METHOD ════════════════════ */}
        <section id="chapter-ii" style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 1140 }}>
            <ChapterHead
              numeral="II"
              label="The Method"
              title="Three motions."
              italic="No refreshing."
              isMobile={isMobile}
            />

            {/* drop-capped lede */}
            <Reveal delay={0.1}>
              <div
                style={{
                  marginTop: 36,
                  maxWidth: 620,
                  fontFamily: SERIF,
                  fontSize: isMobile ? 18 : 20,
                  lineHeight: 1.6,
                  color: "rgba(26, 47, 30, 0.78)",
                }}
              >
                <span
                  style={{
                    float: "left",
                    fontFamily: SERIF,
                    fontSize: isMobile ? 64 : 84,
                    lineHeight: 0.84,
                    fontWeight: 500,
                    color: HERO_GREEN,
                    paddingRight: 12,
                    paddingTop: 6,
                    letterSpacing: "-0.04em",
                  }}
                >
                  T
                </span>
                he system is plain. You name a permit. We hold the watch. When a
                cancellation appears in Recreation.gov's public availability feed,
                your phone receives a single, deep-linked text — and nothing else.
              </div>
            </Reveal>

            <div
              style={{
                clear: "both",
                marginTop: 80,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: 0,
                borderTop: `1px solid ${INK_HAIR}`,
                borderBottom: `1px solid ${INK_HAIR}`,
              }}
            >
              {[
                {
                  num: "I",
                  title: "Watch",
                  body: "Pick a permit — Half Dome cables, Wave, Subway, anything in the Recreation.gov catalog.",
                  marg: "Up to 20 watches on Pro.",
                },
                {
                  num: "II",
                  title: "Scan",
                  body: "Poko polls the public availability endpoint around the clock — every five minutes on Free, every two on Pro.",
                  marg: "Average detection: under thirty seconds.",
                },
                {
                  num: "III",
                  title: "Receive",
                  body: "When a window opens, a single SMS arrives with a deep link straight to that permit's checkout. You finish the booking yourself.",
                  marg: "We never hold your card.",
                },
              ].map((step, i) => (
                <Reveal key={step.num} delay={0.1 + i * 0.08}>
                  <article
                    style={{
                      padding: isMobile ? "36px 0" : "48px 36px",
                      borderRight: !isMobile && i < 2 ? `1px solid ${INK_HAIR}` : "none",
                      borderBottom: isMobile && i < 2 ? `1px solid ${INK_HAIR}` : "none",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontStyle: "italic",
                        fontSize: 56,
                        lineHeight: 1,
                        color: GOLD,
                        marginBottom: 20,
                        fontWeight: 400,
                      }}
                    >
                      {step.num}
                    </div>
                    <h3
                      style={{
                        fontFamily: SERIF,
                        fontSize: 28,
                        fontWeight: 500,
                        color: INK,
                        margin: 0,
                        marginBottom: 12,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: SANS,
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: INK_SOFT,
                        margin: 0,
                      }}
                    >
                      {step.body}
                    </p>
                    <p
                      style={{
                        marginTop: 18,
                        fontFamily: SERIF,
                        fontStyle: "italic",
                        fontSize: 14,
                        color: GOLD,
                        margin: "18px 0 0",
                      }}
                    >
                      — {step.marg}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ III · THE DISPATCH (SMS) ════════════════════ */}
        <section style={{ padding: sectionPad, background: CREAM_WARM, position: "relative" }}>
          {/* corner ornaments — paper edge feel */}
          <div aria-hidden style={cornerOrnament("tl")} />
          <div aria-hidden style={cornerOrnament("tr")} />

          <div
            className="mx-auto"
            style={{
              maxWidth: 1140,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? 56 : 96,
              alignItems: "center",
            }}
          >
            <div>
              <ChapterHead
                numeral="III"
                label="The Dispatch"
                title="A single text."
                italic="Already booked."
                isMobile={isMobile}
              />
              <Reveal delay={0.1}>
                <p
                  style={{
                    marginTop: 28,
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: isMobile ? 19 : 21,
                    lineHeight: 1.55,
                    color: "rgba(26, 47, 30, 0.7)",
                    maxWidth: 460,
                  }}
                >
                  No app to open. No notification panic. The link drops you straight
                  into the Recreation.gov checkout for that exact permit — on that
                  exact date.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <ul
                  style={{
                    marginTop: 32,
                    listStyle: "none",
                    padding: 0,
                    fontFamily: SANS,
                    fontSize: 13,
                    color: INK,
                  }}
                >
                  {[
                    ["Median delivery", "≈ 24s after detection"],
                    ["Carriers", "All major US (10DLC verified)"],
                    ["Reply STOP", "Anytime, per permit"],
                  ].map(([k, v]) => (
                    <li
                      key={k}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        alignItems: "baseline",
                        gap: 12,
                        padding: "12px 0",
                        borderBottom: `1px solid ${INK_FAINT}`,
                      }}
                    >
                      <span style={{ letterSpacing: "0.16em", fontSize: 11, textTransform: "uppercase", color: INK_SOFT }}>{k}</span>
                      <span aria-hidden style={{ height: 1, background: INK_HAIR, alignSelf: "center" }} />
                      <span style={{ fontFamily: MONO, fontSize: 12, color: INK, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal delay={0.15}>
              <IMessageBubble />
            </Reveal>
          </div>
        </section>

        {/* ════════════════════ IV · THE FLEET ════════════════════ */}
        <section style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 1140 }}>
            <div style={{ textAlign: "center" }}>
              <ChapterHead
                numeral="IV"
                label="The Fleet"
                title="Eight parks."
                italic="One quiet watch."
                align="center"
                isMobile={isMobile}
              />
            </div>

            <Reveal delay={0.15}>
              <div style={{ marginTop: 40 }}>
                <Ornament />
              </div>
            </Reveal>

            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                rowGap: 0,
                columnGap: 0,
                borderTop: `1px solid ${INK_HAIR}`,
                borderLeft: `1px solid ${INK_HAIR}`,
              }}
            >
              {LANDING_PARKS.map((p, i) => {
                const lastAlertAt = fleet.byPark[p.id]?.lastAlertAt ?? null;
                const recency = formatRecency(lastAlertAt);
                const isQuiet = recency.startsWith("QUIET") || recency === "STANDING BY";
                return (
                  <Reveal key={p.id} delay={0.04 + i * 0.04}>
                    <div
                      style={{
                        padding: isMobile ? "22px 18px" : "28px 24px",
                        borderRight: `1px solid ${INK_HAIR}`,
                        borderBottom: `1px solid ${INK_HAIR}`,
                        minHeight: 132,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            aria-hidden
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: p.color,
                              boxShadow: !isQuiet ? `0 0 10px ${p.color}` : "none",
                            }}
                          />
                          <h3
                            style={{
                              fontFamily: SERIF,
                              fontSize: isMobile ? 19 : 22,
                              fontWeight: 500,
                              color: INK,
                              margin: 0,
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {p.label}
                          </h3>
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontFamily: MONO,
                            fontSize: 10.5,
                            color: INK_SOFT,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {p.coords}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 16,
                          fontFamily: SANS,
                          fontSize: 10.5,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: isQuiet ? "rgba(26, 47, 30, 0.4)" : HERO_GREEN,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fleet.loading ? "—" : recency}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={0.4}>
              <p
                style={{
                  marginTop: 36,
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: 16,
                  color: "rgba(26, 47, 30, 0.55)",
                  textAlign: "center",
                }}
              >
                {fleet.globalLastAlertAt
                  ? `Last cancellation logged ${formatRecency(fleet.globalLastAlertAt).replace(/^ALERTED\s+/, "").replace(/\s+AGO$/, "").toLowerCase()} ago.`
                  : "The watch is live and updating."}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════ V · MEMBERSHIP (PRICING) ════════════════════ */}
        <section
          id="chapter-v"
          style={{
            padding: sectionPad,
            background: CREAM_WARM,
            position: "relative",
          }}
        >
          <div className="mx-auto" style={{ maxWidth: 1140 }}>
            <div style={{ textAlign: "center" }}>
              <ChapterHead
                numeral="V"
                label="Membership"
                title="Two doors."
                italic="One opens faster."
                align="center"
                isMobile={isMobile}
              />
            </div>

            <Reveal delay={0.15}>
              <div style={{ marginTop: 36, marginBottom: 56 }}>
                <Ornament />
              </div>
            </Reveal>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: isMobile ? 24 : 32,
                maxWidth: 880,
                marginInline: "auto",
              }}
            >
              <Reveal delay={0.1}>
                <PlanCard
                  tone="free"
                  numeral="I"
                  title="Reading Room"
                  price="$0"
                  cadence="forever"
                  hook="One watch. Email alerts. The whole fleet."
                  perks={[
                    "1 permit watch",
                    "Scan every 5 minutes",
                    "Email alerts",
                    "All 8 parks",
                    "Poko · the AI guide",
                  ]}
                  cta={
                    <Link
                      to={ctaPath}
                      onClick={() => trackCta("landing_pricing_free_cta_clicked")}
                      style={{ ...planCtaBase, background: "transparent", color: INK, border: `1px solid ${INK}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26, 47, 30, 0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      Subscribe — Free
                    </Link>
                  }
                />
              </Reveal>

              <Reveal delay={0.18}>
                <PlanCard
                  tone="pro"
                  numeral="II"
                  title="Members' Wing"
                  price="$9"
                  cadence="/ month"
                  hook="Faster scans, more watches, SMS the second a window opens."
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
                        background: INK,
                        color: CREAM,
                        border: "none",
                        cursor: proLoading ? "wait" : "pointer",
                        opacity: proLoading ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!proLoading) e.currentTarget.style.background = HERO_GREEN; }}
                      onMouseLeave={(e) => { if (!proLoading) e.currentTarget.style.background = INK; }}
                    >
                      {proLoading
                        ? <Loader2 className="inline animate-spin" size={16} />
                        : (isMobile ? proCta.copy.labelMobile : proCta.copy.label)}
                    </button>
                  }
                />
              </Reveal>
            </div>

            <Reveal delay={0.3}>
              <p
                style={{
                  marginTop: 36,
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "rgba(26, 47, 30, 0.55)",
                  textAlign: "center",
                }}
              >
                Both halls share Poko, the in-house guide. Membership simply opens the door first.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════ VI · HONEST QUESTIONS (FAQ) ════════════════════ */}
        <section style={{ padding: sectionPad }}>
          <div className="mx-auto" style={{ maxWidth: 820 }}>
            <ChapterHead
              numeral="VI"
              label="Honest Questions"
              title="The fine print,"
              italic="said plainly."
              isMobile={isMobile}
            />
            <div style={{ marginTop: 56, borderTop: `1px solid ${INK_HAIR}` }}>
              {[
                {
                  q: "Are you affiliated with Recreation.gov or the National Park Service?",
                  a: "No. WildAtlas is independent. We watch the public Recreation.gov availability data and notify you when it changes — nothing more.",
                },
                {
                  q: "Do you book the permit for me?",
                  a: "No — that part stays with you. We send a deep link straight to the Recreation.gov checkout page so you can grab it before it's gone.",
                },
                {
                  q: "How quickly will I be notified?",
                  a: "Free scans every five minutes. Members' Wing every two. SMS delivery is typically under thirty seconds after detection.",
                },
                {
                  q: "Which parks are watched?",
                  a: "Yosemite, Zion, Glacier, Grand Canyon, Grand Teton, Arches, Rocky Mountain, and Mt. Rainier. More are quietly being added.",
                },
                {
                  q: "Can I cancel Membership at any time?",
                  a: "Yes. One click in Settings, no email required. You keep access until the end of the billing period.",
                },
                {
                  q: "Will I be flooded with texts?",
                  a: "Only when one of your watched permits opens. That is the entire product. SMS can be disabled per permit at any time.",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={0.04 + i * 0.04}>
                  <FaqRow q={item.q} a={item.a} index={String(i + 1).padStart(2, "0")} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ VII · CLOSING CTA — CINEMATIC ════════════════════
            Not a flat color block. A second pass on the photograph — Half Dome
            re-used at a darker exposure with a single italic line in gold. */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#0A1812",
            color: CREAM,
            padding: isMobile ? "120px 22px" : "200px 56px",
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${halfDomeNight})`,
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              opacity: 0.35,
              filter: "blur(2px) saturate(0.7)",
              transform: "scale(1.04)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(10, 24, 18, 0.25) 0%, rgba(10, 24, 18, 0.85) 60%, rgba(10, 24, 18, 0.96) 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 760, marginInline: "auto" }}>
            <Reveal>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 11,
                  letterSpacing: "0.42em",
                  textTransform: "uppercase",
                  color: GOLD,
                  marginBottom: 28,
                }}
              >
                Chapter VII — Coda
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2
                style={{
                  fontFamily: SERIF,
                  fontWeight: 400,
                  fontSize: isMobile ? 42 : 68,
                  lineHeight: 1.04,
                  letterSpacing: "-0.02em",
                  color: CREAM,
                  margin: 0,
                }}
              >
                Sleep through the cancellations.
                <br />
                <em style={{ fontStyle: "italic", color: GOLD, fontWeight: 400 }}>
                  We'll wake you for the right ones.
                </em>
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <div style={{ margin: "40px auto 0", width: 64, height: 1, background: GOLD, opacity: 0.65 }} />
            </Reveal>
            <Reveal delay={0.22}>
              <Link
                to={ctaPath}
                onClick={() => trackCta("landing_closing_cta_clicked")}
                style={{
                  display: "inline-block",
                  marginTop: 40,
                  fontFamily: SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: INK,
                  background: CREAM,
                  padding: "18px 42px",
                  borderRadius: 2,
                  textDecoration: "none",
                  boxShadow: "0 18px 40px -16px rgba(0,0,0,0.55)",
                  transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {user ? "Open the journal" : "Begin the watch"}
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════ COLOPHON ════════════════════ */}
        <footer style={{ padding: isMobile ? "56px 22px 36px" : "80px 56px 48px", borderTop: `1px solid ${INK_HAIR}` }}>
          <div
            className="mx-auto"
            style={{
              maxWidth: 1140,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr",
              gap: isMobile ? 36 : 64,
            }}
          >
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 26, color: INK, marginBottom: 6, fontWeight: 500 }}>
                WildAtlas
              </div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: GOLD, marginBottom: 14 }}>
                — A field journal of cancellations —
              </div>
              <p
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: "rgba(26, 47, 30, 0.62)",
                  margin: 0,
                  maxWidth: 380,
                }}
              >
                An independent watch on Recreation.gov — kept for travelers who'd rather sleep than refresh.
              </p>
              <p
                style={{
                  marginTop: 18,
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.42)",
                }}
              >
                Not affiliated with the National Park Service or Recreation.gov.
              </p>
            </div>

            <FooterColumn
              label="Sections"
              items={[
                { href: "#chapter-ii", label: "The Method" },
                { href: "#chapter-v", label: "Membership" },
                { href: ctaPath, label: "Begin the watch", to: true, italic: true },
              ]}
            />
            <FooterColumn
              label="Imprint"
              items={[
                { href: "/terms", label: "Terms of Use", to: true },
                { href: "/privacy", label: "Privacy", to: true },
              ]}
            />
          </div>

          <div className="mx-auto" style={{ maxWidth: 1140, marginTop: 56, paddingTop: 24, borderTop: `1px solid ${INK_FAINT}` }}>
            <Ornament />
            <div
              style={{
                marginTop: 24,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 13,
                color: "rgba(26, 47, 30, 0.5)",
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              Set in <span style={{ fontStyle: "normal" }}>Cormorant Garamond</span> &amp;{" "}
              <span style={{ fontStyle: "normal" }}>DM Sans</span>.
              <br />
              Composed in California, printed nightly, delivered by SMS.
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(26, 47, 30, 0.42)",
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              © {today.getFullYear()} WildAtlas · Vol. I · No. {editionNo}
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

/* ───── small style tokens ───── */
const mastheadLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 12,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: INK_SOFT,
  textDecoration: "none",
  transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
};

const planCtaBase: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  fontFamily: SANS,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  padding: "16px 22px",
  borderRadius: 2,
  textDecoration: "none",
  textAlign: "center",
  transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
};

/* Corner ornament — small L-bracket reminiscent of letterpress register marks */
const cornerOrnament = (pos: "tl" | "tr"): React.CSSProperties => {
  const size = 22;
  const off = 22;
  return {
    position: "absolute",
    top: off,
    [pos === "tl" ? "left" : "right"]: off,
    width: size,
    height: size,
    borderTop: `1px solid ${GOLD}`,
    [pos === "tl" ? "borderLeft" : "borderRight"]: `1px solid ${GOLD}`,
    opacity: 0.55,
  };
};

/* ───── PlanCard ───── */
const PlanCard = ({
  tone,
  numeral,
  title,
  price,
  cadence,
  hook,
  perks,
  cta,
  badge,
}: {
  tone: "free" | "pro";
  numeral: string;
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
        border: isPro ? `1px solid ${GOLD}` : `1px solid ${INK_HAIR}`,
        borderRadius: 4,
        padding: isPro ? 36 : 32,
        boxShadow: isPro
          ? `0 24px 60px -24px rgba(181, 138, 63, 0.32), inset 0 0 0 1px ${GOLD_SOFT}`
          : "0 8px 24px -16px rgba(26, 47, 30, 0.14)",
        overflow: "hidden",
      }}
    >
      {/* Pro: gold corner brackets — private club detail */}
      {isPro && (
        <>
          <span aria-hidden style={{ position: "absolute", top: 10, left: 10, width: 14, height: 14, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` }} />
          <span aria-hidden style={{ position: "absolute", top: 10, right: 10, width: 14, height: 14, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` }} />
          <span aria-hidden style={{ position: "absolute", bottom: 10, left: 10, width: 14, height: 14, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` }} />
          <span aria-hidden style={{ position: "absolute", bottom: 10, right: 10, width: 14, height: 14, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` }} />
        </>
      )}

      {badge && (
        <div
          style={{
            position: "absolute",
            top: -1,
            right: 28,
            background: GOLD,
            color: CREAM,
            fontFamily: SANS,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            padding: "5px 12px",
          }}
        >
          {badge}
        </div>
      )}

      {/* eyebrow */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 18,
            color: isPro ? GOLD : INK_SOFT,
          }}
        >
          № {numeral}
        </span>
        <span
          style={{
            fontFamily: SANS,
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: isPro ? GOLD : INK_SOFT,
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 64,
            fontWeight: 500,
            lineHeight: 1,
            color: INK,
            letterSpacing: "-0.02em",
          }}
        >
          {price}
        </span>
        <span style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT }}>{cadence}</span>
      </div>

      <p
        style={{
          marginTop: 18,
          marginBottom: 28,
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: 18,
          lineHeight: 1.45,
          color: "rgba(26, 47, 30, 0.72)",
        }}
      >
        {hook}
      </p>

      <div style={{ height: 1, background: isPro ? GOLD_SOFT : INK_FAINT, marginBottom: 18 }} />

      <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 32 }}>
        {perks.map((p) => (
          <li
            key={p}
            style={{
              display: "grid",
              gridTemplateColumns: "16px 1fr",
              alignItems: "baseline",
              gap: 12,
              fontFamily: SANS,
              fontSize: 14,
              color: INK,
              padding: "10px 0",
            }}
          >
            <span aria-hidden style={{ color: isPro ? GOLD : HERO_GREEN, fontFamily: SERIF, fontSize: 16, lineHeight: 1 }}>✓</span>
            {p}
          </li>
        ))}
      </ul>
      {cta}
    </article>
  );
};

/* ───── FAQ row — numbered, hairline-divided, italic question, gold + glyph ───── */
const FaqRow = ({ q, a, index }: { q: string; a: string; index: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${INK_HAIR}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "24px 0",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "baseline",
          gap: 18,
          minHeight: 44,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: GOLD,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {index}
        </span>
        <span
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 21,
            fontWeight: 500,
            color: INK,
            lineHeight: 1.3,
          }}
        >
          {q}
        </span>
        <span
          aria-hidden
          style={{
            fontFamily: SERIF,
            fontSize: 24,
            color: GOLD,
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          +
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{ overflow: "hidden" }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: 15,
            lineHeight: 1.65,
            color: INK_SOFT,
            margin: 0,
            padding: "0 36px 28px 38px",
          }}
        >
          {a}
        </p>
      </motion.div>
    </div>
  );
};

/* ───── iMessage bubble — full chrome: status bar, contact header, bubble, time ───── */
const IMessageBubble = () => {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAge((a) => (a >= 9 ? 0 : a + 1)), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false });

  return (
    <div
      style={{
        maxWidth: 380,
        marginInline: "auto",
        width: "100%",
        background: "linear-gradient(180deg, #1a1a1c 0%, #0e0e10 100%)",
        borderRadius: 44,
        padding: 10,
        boxShadow:
          "0 40px 80px -24px rgba(26, 47, 30, 0.45), 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 2px #2a2a2c",
      }}
    >
      <div
        style={{
          background: "#000",
          borderRadius: 36,
          overflow: "hidden",
          minHeight: 540,
          color: "#fff",
          position: "relative",
        }}
      >
        {/* status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 28px 10px",
            fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{time}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* signal */}
            <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff" aria-hidden>
              <rect x="0" y="7" width="3" height="4" rx="0.5" />
              <rect x="4.5" y="5" width="3" height="6" rx="0.5" />
              <rect x="9" y="3" width="3" height="8" rx="0.5" />
              <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500 }}>5G</span>
            {/* battery */}
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
              <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" opacity="0.5" />
              <rect x="2" y="2" width="18" height="8" rx="1.5" fill="#fff" />
              <rect x="23" y="3.5" width="2" height="5" rx="1" fill="#fff" opacity="0.5" />
            </svg>
          </div>
        </div>

        {/* header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "10px 0 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${HERO_GREEN}, ${INK})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SERIF,
              fontSize: 24,
              color: GOLD,
              fontWeight: 500,
            }}
          >
            W
          </div>
          <div style={{ fontFamily: "-apple-system, 'SF Pro Text', sans-serif", fontSize: 13, color: "#fff" }}>
            WildAtlas
          </div>
          <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            Text message
          </div>
        </div>

        {/* date stamp */}
        <div
          style={{
            textAlign: "center",
            padding: "16px 0 8px",
            fontFamily: "-apple-system, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          Today {time}
        </div>

        {/* incoming bubble */}
        <div style={{ padding: "8px 16px 24px" }}>
          <div
            style={{
              display: "inline-block",
              maxWidth: "82%",
              background: "#26262A",
              color: "#fff",
              borderRadius: "20px 20px 20px 6px",
              padding: "11px 15px",
              fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
              fontSize: 15,
              lineHeight: 1.35,
              letterSpacing: -0.1,
            }}
          >
            🏕️ Half Dome cables · Jul 14<br />
            <span style={{ opacity: 0.85 }}>2 spots opened. Tap to grab —</span>
            <br />
            <span style={{ color: "#7AB6FF", textDecoration: "underline", textDecorationColor: "rgba(122,182,255,0.5)" }}>
              rec.gov/r/halfdome
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: "-apple-system, sans-serif",
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              paddingLeft: 4,
            }}
          >
            Delivered · {age === 0 ? "now" : `${age} min ago`}
          </div>
        </div>

        {/* home indicator */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 130,
            height: 4,
            borderRadius: 2,
            background: "#fff",
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
};

/* ───── Footer column ───── */
const FooterColumn = ({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string; to?: boolean; italic?: boolean }>;
}) => (
  <div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: INK_SOFT,
        marginBottom: 18,
      }}
    >
      {label}
    </div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => {
        const sx: React.CSSProperties = {
          fontFamily: SERIF,
          fontStyle: item.italic ? "italic" : "normal",
          fontSize: 17,
          color: item.italic ? GOLD : INK,
          textDecoration: "none",
        };
        return (
          <li key={item.href}>
            {item.to
              ? <Link to={item.href} style={sx}>{item.label}{item.italic ? " →" : ""}</Link>
              : <a href={item.href} style={sx}>{item.label}</a>}
          </li>
        );
      })}
    </ul>
  </div>
);

export default LandingPage;
