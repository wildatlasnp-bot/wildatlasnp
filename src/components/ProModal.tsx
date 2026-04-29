import { useState, useEffect, useRef, CSSProperties } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Crown, ArrowRight, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import { getParkConfig } from "@/lib/parks";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";
import heroImage from "@/assets/landing-halfdome-night.jpg";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

let cachedPrice: string | null = null;

// Soft expo-out — long decelerating tail, no overshoot. Shared across modal.
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
// Ambient loops (ken-burns, aurora) use the global standard for a calmer drift.
const EASE_AMBIENT = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Premium Field Pass — cream paper editorial direction.
 * Palette:
 *   Paper:        #F0EDEA  warm cream surface
 *   Paper warm:   #F5EFE7  highlight tint
 *   Ink:          #1A2F1E  deep forest text
 *   Ink soft:     #2C2C2C  body text
 *   Champagne:    #C9A96E  gold leaf accent
 *   Gold deep:    #8C6F3A
 *   Forest CTA:   #2F6F4E  primary action
 */

// Pillars — what Pro actually buys you. Asymmetric, editorial — no table.
const PILLARS: Array<{ kicker: string; title: string; body: string }> = [
  {
    kicker: "i.",
    title: "Unlimited watches",
    body: "Track every park, every permit. No caps, no rationing.",
  },
  {
    kicker: "ii.",
    title: "Two-minute scans",
    body: "Twice the cadence of Free. First in line when a permit reopens.",
  },
  {
    kicker: "iii.",
    title: "SMS dispatch",
    body: "Instant text the moment a window cracks open. Email too.",
  },
];

// Single coherent reveal timeline. Every element subscribes to `phase`,
// so reveals are driven by one shared state — no per-element animation-delay drift.
// Steps must match the visual order of the modal (top → bottom).
const STEP = {
  CORNER_LEFT:  0,
  CORNER_RIGHT: 1,
  TITLE:        2,
  SUBDECK:      3,
  RULE:         4,
  PILLAR_0:     5,
  PILLAR_1:     6,
  PILLAR_2:     7,
  PROOF:        8,
  PRICE:        9,
  CTA:         10,
  ARL:         11,
  DIVIDER:     12,
  TRUST:       13,
  REFUND:      14,
} as const;

// Tempo: gap between consecutive reveals. One value, one rhythm.
const STEP_GAP_MS = 110;
// Initial delay so the modal's own entrance settles first.
const TIMELINE_OFFSET_MS = 380;
// Single transition spec shared by every revealed element.
const REVEAL_TRANSITION = "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [loading, setLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<string | null>(cachedPrice);
  const [phase, setPhase] = useState(-1); // -1 = nothing revealed yet
  const timersRef = useRef<number[]>([]);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isPro } = useProStatus();
  // Live social proof — most recent permit catch across all parks.
  const { finds: recentFinds } = useRecentFinds();
  const latestFind = recentFinds[0] ?? null;

  // Drive the single timeline. One scheduler, one source of truth.
  useEffect(() => {
    // Clean any prior run.
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    if (!open) {
      setPhase(-1);
      return;
    }

    // Honor reduced-motion: reveal everything immediately.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase(Object.keys(STEP).length);
      return;
    }

    const totalSteps = Object.keys(STEP).length;
    for (let i = 0; i < totalSteps; i++) {
      const id = window.setTimeout(
        () => setPhase((p) => (p < i ? i : p)),
        TIMELINE_OFFSET_MS + i * STEP_GAP_MS,
      );
      timersRef.current.push(id);
    }

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [open]);

  // Helper: produce the reveal style for a given step.
  // `from` lets each element choose its motion vector while sharing the timeline.
  const revealStyle = (
    step: number,
    from: "up" | "down" | "none" = "up",
  ): CSSProperties => {
    const visible = phase >= step;
    const offset =
      from === "up" ? "translate3d(0, 12px, 0)"
      : from === "down" ? "translate3d(0, -8px, 0)"
      : "none";
    return {
      opacity: visible ? 1 : 0,
      transform: visible ? "translate3d(0, 0, 0)" : offset,
      transition: REVEAL_TRANSITION,
      // No `will-change` here — it would promote 14 layers and balloon GPU memory
      // on mobile. translate3d already hints the compositor for the brief reveal.
    };
  };


  useEffect(() => {
    if (!open || cachedPrice !== null) return;
    supabase.functions.invoke("create-checkout", { method: "GET" })
      .then(({ data }) => {
        const price = data?.displayPrice ?? "$9.99";
        cachedPrice = price;
        setDisplayPrice(price);
      })
      .catch(() => {
        cachedPrice = "$9.99";
        setDisplayPrice("$9.99");
      });
  }, [open]);

  const handleCheckout = async () => {
    if (!user) return;
    posthog.capture("upgrade_clicked");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.action === "sign_out_and_back_in") {
        toast({
          title: "Account needs a quick fix",
          description: "Your account needs a quick fix — please sign out and sign back in.",
          action: (
            <button
              className="text-[12px] font-semibold text-primary hover:underline whitespace-nowrap"
              onClick={() => { signOut(); onOpenChange(false); }}
            >
              Sign Out
            </button>
          ),
        });
        return;
      }
      if (data?.error === "already_subscribed") {
        toast({ title: "Already subscribed!", description: "You're already a Pro member. Manage your subscription in Settings." });
        onOpenChange(false);
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      console.error("Checkout error:", e);
      toast({
        title: "Trail hiccup",
        description: "Couldn't start checkout. Please try again!",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="block p-0 gap-0 overflow-hidden border-0 max-h-[94vh] overflow-y-auto pro-modal-premium"
        style={{
          maxWidth: "min(404px, calc(100vw - 24px))",
          borderRadius: 20,
          background: "#F0EDEA",
          color: "#1A2F1E",
          zIndex: 1000,
          // Soft cream paper — gentle ambient + warm rim highlight.
          boxShadow: [
            "0 50px 120px -24px rgba(26,47,30,0.32)",
            "0 22px 50px -16px rgba(26,47,30,0.22)",
            "inset 0 1px 0 rgba(255,255,255,0.6)",
            "inset 0 0 0 1px rgba(201,169,110,0.28)",
          ].join(", "),
          animation: `proModalIn 720ms ${EASE} both`,
          contain: "paint layout style",
          isolation: "isolate",
        }}
      >
        {/* ============ HERO — silent night, gold corner mark ============ */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 168,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {/* Image — promoted to its own compositor layer for cheap transform animation.
              Filters are intentionally avoided here: `filter` forces a fullscreen
              software pass on every animation frame on mobile WebKit. We achieve
              the muted-tonal look with the gradient overlay below instead. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center 38%",
              animation: `proHeroKenBurns 32s ${EASE_AMBIENT} both`,
              willChange: "transform",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          />
          {/* Tonal gradient — vignette top, dissolve to deep ink at bottom.
              Top scrim is slightly heavier than before to compensate for dropping
              the image-level saturate/contrast filter (mobile perf win). */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                "radial-gradient(120% 80% at 50% 0%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 55%)",
                "linear-gradient(180deg, rgba(14,26,20,0.18) 0%, rgba(14,26,20,0.55) 60%, rgba(240,237,234,0.85) 92%, #F0EDEA 100%)",
              ].join(", "),
            }}
          />
          {/* Aurora — soft warm haze. The radial gradient is already feathered,
              so we drop the previous `filter: blur(24px)` (the single most
              expensive paint primitive on mobile) and stretch the gradient
              instead. Visually equivalent, ~10× cheaper per frame. */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "-15%", top: "-35%",
              width: "80%", height: "110%",
              background: "radial-gradient(ellipse at center, rgba(201,169,110,0.20) 0%, rgba(201,169,110,0.08) 35%, rgba(201,169,110,0) 70%)",
              animation: `proAuroraDrift 22s ${EASE_AMBIENT} infinite alternate`,
              willChange: "transform, opacity",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          />

          {/* One-shot embossed light sweep — fires after the hero settles. */}
          <span aria-hidden className="pro-sheen pro-sheen--hero" />
          {/* Corner mark — coordinate-style wordmark, top-left */}
          <div
            className="absolute"
            style={{
              top: 18, left: 20,
              ...revealStyle(STEP.CORNER_LEFT, "down"),
            }}
          >
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(245,235,211,0.55)",
              }}
            >
              N 37° 44′ · W 119° 32′
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: "#C9A96E",
              }}
            >
              WildAtlas — Pro
            </div>
          </div>

          {/* Issue/serial — top right, like a passport */}
          <div
            className="absolute text-right"
            style={{
              top: 18, right: 20,
              ...revealStyle(STEP.CORNER_RIGHT, "down"),
            }}
          >
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(245,235,211,0.45)",
              }}
            >
              Field Pass
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.18em",
                color: "rgba(201,169,110,0.85)",
              }}
            >
              Vol. 01 / Issue 04
            </div>
          </div>
        </div>

        {/* ============ EDITORIAL TITLE — overlaps hero/body seam ============ */}
        <div
          style={{
            padding: "0 26px",
            marginTop: -28,
            position: "relative",
            zIndex: 2,
            ...revealStyle(STEP.TITLE, "up"),
          }}
        >
          <h2
            className="font-heading"
            style={{
              fontSize: 34,
              fontWeight: 400,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              color: "#F5EBD3",
              textShadow: "0 2px 22px rgba(0,0,0,0.55)",
            }}
          >
            The window{" "}
            <em style={{ fontStyle: "italic", color: "#C9A96E" }}>opens.</em>
            <br />
            You're already there.
          </h2>
        </div>

        {/* ============ BODY ============ */}
        <div style={{ padding: "16px 26px 24px" }}>
          {/* Sub-deck — drop-cap-ish lead */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "rgba(245,235,211,0.72)",
              lineHeight: 1.6,
              marginTop: 4,
              ...revealStyle(STEP.SUBDECK, "up"),
            }}
          >
            A permit slips back into the wild every few minutes.
            Pro is the difference between hearing about it and being there.
          </p>

          {/* Hairline rule — gold */}
          <div
            style={{
              marginTop: 22,
              height: 1,
              background:
                "linear-gradient(90deg, rgba(201,169,110,0) 0%, rgba(201,169,110,0.45) 50%, rgba(201,169,110,0) 100%)",
              ...revealStyle(STEP.RULE, "up"),
            }}
          />

          {/* ============ PILLARS — editorial, not a table ============ */}
          <div style={{ marginTop: 18 }}>
            {PILLARS.map((p, i) => (
              <div
                key={p.kicker}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  columnGap: 14,
                  paddingTop: i === 0 ? 0 : 14,
                  paddingBottom: 14,
                  borderBottom:
                    i === PILLARS.length - 1
                      ? "none"
                      : "1px solid rgba(201,169,110,0.10)",
                  ...revealStyle(STEP.PILLAR_0 + i, "up"),
                }}
              >
                <span
                  className="font-heading"
                  style={{
                    fontStyle: "italic",
                    fontSize: 18,
                    fontWeight: 400,
                    color: "#C9A96E",
                    lineHeight: 1.2,
                    paddingTop: 2,
                  }}
                >
                  {p.kicker}
                </span>
                <div>
                  <div
                    className="font-heading"
                    style={{
                      fontSize: 19,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      letterSpacing: "-0.005em",
                      color: "#F5EBD3",
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "rgba(245,235,211,0.62)",
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              </div>
            ))}
          </div>


          {/* ============ LIVE PROOF — only renders when we have real data ============ */}
          {latestFind && (() => {
            const minsAgo = Math.max(1, Math.floor((Date.now() - new Date(latestFind.found_at).getTime()) / 60000));
            const timeLabel =
              minsAgo < 60 ? `${minsAgo} min ago`
              : minsAgo < 1440 ? `${Math.floor(minsAgo / 60)}h ago`
              : `${Math.floor(minsAgo / 1440)}d ago`;
            const parkShort = getParkConfig(latestFind.park_id).shortName;
            return (
              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  color: "rgba(245,235,211,0.62)",
                  ...revealStyle(STEP.PROOF, "up"),
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#7FB98B",
                    boxShadow: "0 0 0 4px rgba(127,185,139,0.18), 0 0 10px rgba(127,185,139,0.55)",
                    animation: "proPulse 2.4s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "rgba(245,235,211,0.85)" }}>
                  Caught{" "}
                  <span style={{ color: "#C9A96E", fontWeight: 600 }}>{timeLabel}</span>
                  <span style={{ color: "rgba(201,169,110,0.45)", margin: "0 6px" }}>·</span>
                  <span style={{ fontStyle: "italic", color: "rgba(245,235,211,0.78)" }}>
                    {latestFind.permit_name}
                  </span>
                  <span style={{ color: "rgba(245,235,211,0.45)" }}> · {parkShort}</span>
                </span>
              </div>
            );
          })()}

          {/* ============ PRICE — struck-metal embossed artifact ============ */}
          {(() => {
            // Split price like "$9.99" → symbol "$", whole "9", decimal ".99"
            const raw = displayPrice ?? "";
            const m = raw.match(/^([^\d]*)(\d+)([.,]\d+)?$/);
            const sym = m?.[1] ?? "$";
            const whole = m?.[2] ?? "";
            const dec = m?.[3] ?? "";
            return (
              <div
                style={{
                  position: "relative",
                  marginTop: latestFind ? 14 : 22,
                  borderRadius: 16,
                  padding: "20px 22px",
                  // Clip the sheen sweep to the plate's rounded rect.
                  overflow: "hidden",
                  background:
                    "linear-gradient(180deg, rgba(245,235,211,0.07) 0%, rgba(201,169,110,0.045) 48%, rgba(0,0,0,0.18) 100%)",
                  border: "1px solid rgba(201,169,110,0.32)",
                  // Deep inset rim + outer drop = struck/embossed feel
                  boxShadow: [
                    "inset 0 1px 0 rgba(245,235,211,0.14)",
                    "inset 0 -1px 0 rgba(0,0,0,0.45)",
                    "inset 0 0 0 1px rgba(201,169,110,0.08)",
                    "0 1px 0 rgba(245,235,211,0.04)",
                    "0 22px 44px -24px rgba(0,0,0,0.7)",
                  ].join(", "),
                  ...revealStyle(STEP.PRICE, "up"),
                }}
              >
                {/* One-shot embossed light sweep across the plate. */}
                <span aria-hidden className="pro-sheen pro-sheen--plate" />

                {/* Hairline gold corner ticks — top-left & bottom-right */}
                <span aria-hidden style={{ position: "absolute", top: 8, left: 8, width: 10, height: 10, borderTop: "1px solid rgba(201,169,110,0.55)", borderLeft: "1px solid rgba(201,169,110,0.55)", borderTopLeftRadius: 3 }} />
                <span aria-hidden style={{ position: "absolute", bottom: 8, right: 8, width: 10, height: 10, borderBottom: "1px solid rgba(201,169,110,0.55)", borderRight: "1px solid rgba(201,169,110,0.55)", borderBottomRightRadius: 3 }} />

                <div style={{ display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: 18 }}>
                  {/* LEFT — eyebrow + meta */}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 2, paddingBottom: 2 }}>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.32em",
                        textTransform: "uppercase",
                        // Gold-foil gradient text
                        background: "linear-gradient(180deg, #E6C887 0%, #C9A96E 55%, #8C6F3A 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      Field Pass
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div
                        className="font-heading"
                        style={{
                          fontStyle: "italic",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#F5EBD3",
                          letterSpacing: "-0.005em",
                          lineHeight: 1.1,
                        }}
                      >
                        Monthly subscription
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12,
                          color: "rgba(245,235,211,0.55)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Cancel anytime · billed via Stripe
                      </div>
                    </div>
                  </div>

                  {/* Vertical hairline divider */}
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      alignSelf: "stretch",
                      background: "linear-gradient(180deg, rgba(201,169,110,0) 0%, rgba(201,169,110,0.35) 50%, rgba(201,169,110,0) 100%)",
                    }}
                  />

                  {/* RIGHT — engraved numeral */}
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", minWidth: 110 }}>
                    {displayPrice === null ? (
                      <span className="inline-block w-20 h-10 bg-white/10 animate-pulse rounded" />
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 1 }}>
                          <span
                            className="font-heading"
                            style={{
                              fontSize: 18,
                              fontWeight: 500,
                              color: "#F5EBD3",
                              marginTop: 6,
                              marginRight: 2,
                              opacity: 0.85,
                              textShadow: "0 1px 0 rgba(0,0,0,0.5)",
                            }}
                          >
                            {sym}
                          </span>
                          <span
                            className="font-heading"
                            style={{
                              fontSize: 52,
                              fontWeight: 500,
                              letterSpacing: "-0.035em",
                              lineHeight: 0.9,
                              color: "#FBF3DC",
                              // Engraved double-shadow: dark depth + champagne rim light
                              textShadow: [
                                "0 1px 0 rgba(245,235,211,0.18)",
                                "0 -1px 0 rgba(0,0,0,0.55)",
                                "0 2px 14px rgba(0,0,0,0.45)",
                              ].join(", "),
                            }}
                          >
                            {whole}
                          </span>
                          {dec && (
                            <span
                              className="font-heading"
                              style={{
                                fontStyle: "italic",
                                fontSize: 22,
                                fontWeight: 500,
                                color: "#C9A96E",
                                marginTop: 6,
                                marginLeft: 1,
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {dec}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            color: "rgba(245,235,211,0.55)",
                          }}
                        >
                          USD / month
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ============ CTA BLOCK — primary + reassurance row ============ */}
          <div
            style={{
              marginTop: 18,
              ...revealStyle(STEP.CTA, "up"),
            }}
          >
            <motion.button
              whileTap={{ scale: 0.985 }}
              onClick={handleCheckout}
              disabled={loading || isPro}
              className="cta-shimmer relative overflow-hidden"
              style={{
                width: "100%",
                padding: "18px 20px",
                borderRadius: 14,
                background:
                  "linear-gradient(180deg, #357B57 0%, #245A3D 55%, #143524 100%)",
                color: "#FBF3DC",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.02em",
                cursor: loading || isPro ? "default" : "pointer",
                border: "1px solid rgba(201,169,110,0.55)",
                boxShadow: [
                  "inset 0 1px 0 rgba(245,235,211,0.22)",
                  "inset 0 -1px 0 rgba(0,0,0,0.40)",
                  "0 22px 44px -12px rgba(0,0,0,0.65)",
                  "0 0 0 1px rgba(201,169,110,0.14)",
                ].join(", "),
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 10,
              }}
            >
              {loading ? (
                <>
                  <span />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Loader2 size={16} className="animate-spin" />
                    Opening checkout…
                  </span>
                  <span />
                </>
              ) : isPro ? (
                <>
                  <span />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Crown size={15} />
                    You're already Pro
                  </span>
                  <span />
                </>
              ) : (
                <>
                  <span />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    Claim your Field Pass
                  </span>
                  <ArrowRight size={16} style={{ justifySelf: "end", opacity: 0.9 }} />
                </>
              )}
            </motion.button>

            {/* Reassurance micro-row, right under CTA */}
            {!isPro && !loading && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: "rgba(245,235,211,0.62)",
                  letterSpacing: "0.04em",
                }}
              >
                <Lock size={12} style={{ color: "rgba(201,169,110,0.85)" }} strokeWidth={2.2} />
                <span>Secure checkout</span>
                <span style={{ color: "rgba(201,169,110,0.45)" }}>·</span>
                <span>7-day refund</span>
                <span style={{ color: "rgba(201,169,110,0.45)" }}>·</span>
                <span>Instant access</span>
              </div>
            )}
          </div>

          {/* ARL disclosure */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(245,235,211,0.50)",
              textAlign: "center",
              margin: "12px 4px 0",
              lineHeight: 1.55,
              ...revealStyle(STEP.ARL, "up"),
            }}
          >
            By subscribing, you authorize a recurring{" "}
            {displayPrice ? `${displayPrice}/month` : "monthly"} charge. Cancel anytime in
            Settings.{" "}
            <a
              href="https://wildatlas.app/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#C9A96E", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              Full terms
            </a>
          </p>

          {/* Hairline divider — gold */}
          <div
            style={{
              marginTop: 18,
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.28) 50%, transparent 100%)",
              ...revealStyle(STEP.DIVIDER, "up"),
            }}
          />

          {/* Trust row */}
          <div
            className="flex items-center justify-center"
            style={{
              gap: 18,
              marginTop: 14,
              ...revealStyle(STEP.TRUST, "up"),
            }}
          >
            {[
              { icon: Lock, label: "Secure" },
              { icon: RefreshCw, label: "Cancel anytime" },
              { icon: ShieldCheck, label: "No hidden fees" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <t.icon size={12} style={{ color: "rgba(201,169,110,0.75)" }} strokeWidth={2.2} />
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "rgba(245,235,211,0.55)",
                    fontWeight: 500,
                  }}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>

          {/* Refund link */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(245,235,211,0.40)",
              textAlign: "center",
              marginTop: 14,
              ...revealStyle(STEP.REFUND, "up"),
            }}
          >
            <button
              onClick={() => setRefundOpen(true)}
              className="underline underline-offset-2 transition-colors hover:text-[#C9A96E]"
              style={{ color: "rgba(245,235,211,0.55)", fontSize: 12 }}
            >
              Refund Policy
            </button>
          </p>

          {/* Refund Policy Modal */}
          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogContent className="max-w-sm rounded-2xl p-6 bg-card">
              <h3 className="text-[15px] font-heading font-bold text-foreground mb-3">Refund Policy</h3>
              <div className="space-y-2.5 text-[12px] text-muted-foreground leading-relaxed">
                <p>We want you to be happy with WildAtlas Pro. If you're not satisfied, here's how refunds work:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>Request a refund within <strong className="text-foreground">7 days</strong> of your first payment for a full refund — no questions asked.</li>
                  <li>After 7 days, refunds are prorated based on remaining time in your billing cycle.</li>
                  <li>Cancel anytime from Settings to stop future charges immediately.</li>
                </ul>
                <p>Contact us at <strong className="text-foreground">wildatlasnp@gmail.com</strong> for refund requests.</p>
              </div>
              <button
                onClick={() => setRefundOpen(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-muted text-foreground text-[13px] font-semibold hover:bg-muted/80 transition-colors"
              >
                Got it
              </button>
            </DialogContent>
          </Dialog>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProModal;
