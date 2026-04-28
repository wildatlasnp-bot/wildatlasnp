import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Crown, ArrowRight, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";
import heroImage from "@/assets/landing-halfdome-night.jpg";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

let cachedPrice: string | null = null;

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Premium Field Pass — dark editorial direction.
 * Palette:
 *   Ink (paper):  #0E1A14  deep forest near-black
 *   Vellum:       #F5EBD3  warm cream highlight
 *   Champagne:    #C9A96E  gold leaf
 *   Gold deep:    #8C6F3A
 *   Moss:         #5C7A5E  hairlines
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

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [loading, setLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<string | null>(cachedPrice);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isPro } = useProStatus();

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
          background: "#0E1A14",
          color: "#F5EBD3",
          zIndex: 1000,
          // Embossed dark vellum — deep ambient + a single warm rim highlight.
          boxShadow: [
            "0 50px 120px -24px rgba(0,0,0,0.78)",
            "0 22px 50px -16px rgba(0,0,0,0.55)",
            "inset 0 1px 0 rgba(245,235,211,0.10)",
            "inset 0 0 0 1px rgba(201,169,110,0.18)",
          ].join(", "),
          animation: `proModalIn 520ms ${EASE} both`,
        }}
      >
        {/* ============ HERO — silent night, gold corner mark ============ */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 220,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {/* Image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center 38%",
              animation: `proHeroKenBurns 18s ${EASE} both`,
              willChange: "transform",
              filter: "saturate(0.78) contrast(1.04)",
            }}
          />
          {/* Tonal gradient — vignette top, dissolve to deep ink at bottom */}
          <div
            className="absolute inset-0"
            style={{
              background: [
                "radial-gradient(120% 80% at 50% 0%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
                "linear-gradient(180deg, rgba(14,26,20,0.10) 0%, rgba(14,26,20,0.55) 55%, #0E1A14 100%)",
              ].join(", "),
            }}
          />
          {/* Aurora — subtle warm haze */}
          <div
            aria-hidden
            className="absolute"
            style={{
              left: "-10%", top: "-30%",
              width: "70%", height: "100%",
              background: "radial-gradient(ellipse at center, rgba(201,169,110,0.16) 0%, rgba(201,169,110,0) 65%)",
              filter: "blur(24px)",
              animation: `proAuroraDrift 14s ${EASE} infinite alternate`,
            }}
          />

          {/* Corner mark — coordinate-style wordmark, top-left */}
          <div
            className="absolute"
            style={{
              top: 18, left: 20,
              opacity: 0,
              animation: `proFadeDown 600ms ${EASE} 220ms both`,
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
              opacity: 0,
              animation: `proFadeDown 600ms ${EASE} 280ms both`,
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
            marginTop: -36,
            position: "relative",
            zIndex: 2,
            opacity: 0,
            animation: `proFadeUp 720ms ${EASE} 380ms both`,
          }}
        >
          <h2
            className="font-heading"
            style={{
              fontSize: 38,
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
        <div style={{ padding: "20px 26px 24px" }}>
          {/* Sub-deck — drop-cap-ish lead */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "rgba(245,235,211,0.72)",
              lineHeight: 1.6,
              marginTop: 4,
              opacity: 0,
              animation: `proFadeUp 600ms ${EASE} 520ms both`,
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
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 600ms both`,
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
                  opacity: 0,
                  animation: `proRowIn 500ms ${EASE} ${720 + i * 90}ms both`,
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

          {/* ============ PRICE — embossed plate ============ */}
          <div
            style={{
              marginTop: 22,
              borderRadius: 14,
              padding: "16px 18px",
              background:
                "linear-gradient(180deg, rgba(245,235,211,0.04) 0%, rgba(201,169,110,0.06) 100%)",
              border: "1px solid rgba(201,169,110,0.22)",
              boxShadow:
                "inset 0 1px 0 rgba(245,235,211,0.08), 0 14px 36px -22px rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              opacity: 0,
              animation: `proFadeUp 560ms ${EASE} ${720 + PILLARS.length * 90 + 60}ms both`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(201,169,110,0.85)",
                }}
              >
                Subscription
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: "rgba(245,235,211,0.55)",
                }}
              >
                Monthly · cancel anytime
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {displayPrice === null ? (
                <span className="inline-block w-16 h-6 bg-white/10 animate-pulse rounded" />
              ) : (
                <>
                  <span
                    className="font-heading"
                    style={{
                      fontSize: 30,
                      fontWeight: 500,
                      letterSpacing: "-0.015em",
                      color: "#F5EBD3",
                    }}
                  >
                    {displayPrice}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: "rgba(245,235,211,0.55)",
                      marginLeft: 4,
                    }}
                  >
                    /mo
                  </span>
                </>
              )}
            </div>
          </div>

          {/* CTA — gold-rimmed dark forest */}
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={handleCheckout}
            disabled={loading || isPro}
            className="cta-shimmer relative overflow-hidden"
            style={{
              width: "100%",
              padding: "16px",
              marginTop: 16,
              borderRadius: 14,
              background:
                "linear-gradient(180deg, #2F6F4E 0%, #225239 55%, #173A28 100%)",
              color: "#F5EBD3",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: loading || isPro ? "default" : "pointer",
              border: "1px solid rgba(201,169,110,0.45)",
              boxShadow: [
                "inset 0 1px 0 rgba(245,235,211,0.18)",
                "inset 0 -1px 0 rgba(0,0,0,0.30)",
                "0 18px 38px -10px rgba(0,0,0,0.55)",
                "0 0 0 1px rgba(201,169,110,0.10)",
              ].join(", "),
              opacity: 0,
              animation: `proFadeUp 540ms ${EASE} 1240ms both`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Opening checkout…
              </>
            ) : isPro ? (
              <>
                <Crown size={15} />
                You're already Pro
              </>
            ) : (
              <>
                Claim your Field Pass
                <ArrowRight size={15} />
              </>
            )}
          </motion.button>

          {/* ARL disclosure */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(245,235,211,0.50)",
              textAlign: "center",
              margin: "12px 4px 0",
              lineHeight: 1.55,
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1340ms both`,
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
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1420ms both`,
            }}
          />

          {/* Trust row */}
          <div
            className="flex items-center justify-center"
            style={{
              gap: 18,
              marginTop: 14,
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1520ms both`,
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
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1580ms both`,
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
