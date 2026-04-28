import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Crown, ArrowRight, Loader2, Lock, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
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

// Comparison ledger rows — feature, free state, pro state
const COMPARISON: Array<{ label: string; free: string; pro: string; proHighlight?: boolean }> = [
  { label: "Permit watches", free: "1", pro: "Unlimited", proHighlight: true },
  { label: "Email alerts", free: "•", pro: "•" },
  { label: "SMS alerts", free: "—", pro: "•" },
  { label: "Scan cadence", free: "5 min", pro: "2 min", proHighlight: true },
  { label: "Priority dispatch", free: "—", pro: "•" },
];

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [loading, setLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<string | null>(cachedPrice);
  const [statCount, setStatCount] = useState(0);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isPro } = useProStatus();

  useEffect(() => {
    if (!open) { setStatCount(0); return; }
    const duration = 700;
    let start = 0;
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setStatCount(Math.round(eased * 3));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { start = Date.now(); requestAnimationFrame(tick); }, 700);
    return () => clearTimeout(timer);
  }, [open]);

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
          borderRadius: 22,
          background: "#FBF8F3",
          zIndex: 1000,
          boxShadow:
            "0 40px 100px -20px rgba(20, 35, 25, 0.45), 0 18px 40px -12px rgba(20, 35, 25, 0.28), 0 0 0 1px rgba(47,111,78,0.08)",
          animation: `proModalIn 520ms ${EASE} both`,
        }}
      >
        {/* ============ CINEMATIC HERO ============ */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 188,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
          }}
        >
          {/* Ken-burns image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center 35%",
              animation: `proHeroKenBurns 14s ${EASE} both`,
              willChange: "transform",
            }}
          />
          {/* Tonal gradient: deep forest at top, dissolving to cream at bottom */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(12,28,20,0.55) 0%, rgba(12,28,20,0.18) 38%, rgba(251,248,243,0.0) 62%, rgba(251,248,243,0.85) 92%, #FBF8F3 100%)",
            }}
          />
          {/* Aurora glow accent */}
          <div
            aria-hidden
            className="absolute"
            style={{
              left: "-15%", top: "-30%",
              width: "70%", height: "120%",
              background: "radial-gradient(ellipse at center, rgba(201,169,110,0.22) 0%, rgba(201,169,110,0) 60%)",
              filter: "blur(20px)",
              animation: `proAuroraDrift 12s ${EASE} infinite alternate`,
            }}
          />

          {/* Top eyebrow row */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between"
            style={{
              padding: "16px 20px 0",
              opacity: 0,
              animation: `proFadeDown 600ms ${EASE} 240ms both`,
            }}
          >
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#C9A96E",
                  boxShadow: "0 0 8px rgba(201,169,110,0.85)",
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,250,240,0.92)",
                }}
              >
                WildAtlas · Pro
              </span>
            </div>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,250,240,0.55)",
              }}
            >
              Field Pass
            </span>
          </div>

          {/* Editorial title */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: 28,
              padding: "0 24px",
              textAlign: "center",
              opacity: 0,
              animation: `proFadeUp 700ms ${EASE} 380ms both`,
            }}
          >
            <h2
              className="font-heading"
              style={{
                fontSize: 30,
                fontWeight: 400,
                color: "#FBF8F3",
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 18px rgba(8,18,12,0.55)",
              }}
            >
              The permit{" "}
              <em style={{ fontStyle: "italic", color: "#E8D7B0" }}>opens.</em>
              <br />
              You're already there.
            </h2>
          </div>
        </div>

        {/* ============ BODY ============ */}
        <div style={{ padding: "8px 26px 24px" }}>
          {/* Sub-deck */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: "#5C6258",
              textAlign: "center",
              lineHeight: 1.55,
              marginTop: 4,
              opacity: 0,
              animation: `proFadeUp 600ms ${EASE} 520ms both`,
            }}
          >
            A permit slips back into the wild every few minutes.
            <br />
            Pro puts you first in line — every time.
          </p>

          {/* ============ COMPARISON LEDGER ============ */}
          <div
            style={{
              marginTop: 22,
              borderRadius: 14,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FBF7F0 100%)",
              border: "1px solid rgba(47,111,78,0.14)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 14px 36px -18px rgba(47,111,78,0.22)",
              overflow: "hidden",
              position: "relative",
              opacity: 0,
              animation: `proFadeUp 640ms ${EASE} 620ms both`,
            }}
          >
            {/* Foil seal */}
            <div
              className="absolute"
              style={{
                top: 14, right: 14,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #2F6F4E 0%, #1F4D36 100%)",
                boxShadow: "0 4px 14px rgba(47,111,78,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <Sparkles size={11} style={{ color: "#E8D7B0" }} strokeWidth={2.4} />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FBF8F3",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Recommended
              </span>
            </div>

            {/* Header row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "1.4fr 0.9fr 0.9fr",
                padding: "44px 18px 12px",
                borderBottom: "1px solid rgba(47,111,78,0.10)",
                alignItems: "end",
              }}
            >
              <div />
              <div style={{ textAlign: "center" }}>
                <p
                  className="font-heading"
                  style={{ fontSize: 15, fontWeight: 500, color: "#9A958C", letterSpacing: "0.01em" }}
                >
                  Free
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  className="font-heading"
                  style={{
                    fontSize: 17,
                    fontWeight: 500,
                    color: "#2F6F4E",
                    letterSpacing: "0.01em",
                  }}
                >
                  Pro
                </p>
              </div>
            </div>

            {/* Rows */}
            <div>
              {COMPARISON.map((row, i) => (
                <div
                  key={row.label}
                  className="grid"
                  style={{
                    gridTemplateColumns: "1.4fr 0.9fr 0.9fr",
                    padding: "11px 18px",
                    borderBottom:
                      i === COMPARISON.length - 1 ? "none" : "1px solid rgba(47,111,78,0.06)",
                    alignItems: "center",
                    opacity: 0,
                    animation: `proRowIn 460ms ${EASE} ${720 + i * 70}ms both`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#3D4438",
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      textAlign: "center",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 400,
                      color: row.free === "—" ? "#C7C2B8" : "#8A8579",
                    }}
                  >
                    {row.free}
                  </span>
                  <span
                    style={{
                      textAlign: "center",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: row.proHighlight ? 600 : 500,
                      color: row.proHighlight ? "#1F4D36" : "#2F6F4E",
                    }}
                  >
                    {row.pro}
                  </span>
                </div>
              ))}
            </div>

            {/* Price strip */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "1.4fr 0.9fr 0.9fr",
                padding: "14px 18px 16px",
                background:
                  "linear-gradient(180deg, rgba(47,111,78,0.04) 0%, rgba(201,169,110,0.06) 100%)",
                borderTop: "1px solid rgba(47,111,78,0.10)",
                alignItems: "baseline",
                opacity: 0,
                animation: `proFadeUp 520ms ${EASE} ${720 + COMPARISON.length * 70 + 60}ms both`,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#7A7569",
                }}
              >
                Monthly
              </span>
              <span
                style={{
                  textAlign: "center",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "#9A958C",
                }}
              >
                $0
              </span>
              <span style={{ textAlign: "center" }}>
                {displayPrice === null ? (
                  <span className="inline-block w-10 h-4 bg-muted/60 animate-pulse rounded" />
                ) : (
                  <>
                    <span
                      className="font-heading"
                      style={{ fontSize: 22, fontWeight: 500, color: "#1F4D36", letterSpacing: "-0.01em" }}
                    >
                      {displayPrice}
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "#9A958C",
                        marginLeft: 2,
                      }}
                    >
                      /mo
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Stat line */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "#5C6258",
              textAlign: "center",
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1100ms both`,
            }}
          >
            <Sparkles size={12} style={{ color: "#C9A96E" }} strokeWidth={2.4} />
            Pro members catch{" "}
            <em
              className="font-heading"
              style={{ fontStyle: "italic", fontWeight: 500, color: "#1F4D36", fontSize: 14 }}
            >
              {statCount}× more
            </em>{" "}
            permit openings
          </p>

          {/* CTA */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckout}
            disabled={loading || isPro}
            className="cta-shimmer relative overflow-hidden"
            style={{
              width: "100%",
              padding: "16px",
              marginTop: 18,
              borderRadius: 14,
              background:
                "linear-gradient(180deg, #357A56 0%, #2A6443 50%, #1F4D36 100%)",
              color: "#FBF8F3",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.01em",
              cursor: loading || isPro ? "default" : "pointer",
              border: "1px solid rgba(31,77,54,0.65)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12), 0 18px 38px -10px rgba(31,77,54,0.50), 0 4px 10px rgba(31,77,54,0.18)",
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
              color: "#7A7569",
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
              style={{ color: "#2F6F4E", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              Full terms
            </a>
          </p>

          {/* Hairline divider */}
          <div
            style={{
              marginTop: 18,
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(47,111,78,0.18) 50%, transparent 100%)",
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1420ms both`,
            }}
          />

          {/* Social proof */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "#7A7569",
              textAlign: "center",
              marginTop: 14,
              letterSpacing: "0.02em",
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1460ms both`,
            }}
          >
            Joined by hikers tracking{" "}
            <em className="font-heading" style={{ fontStyle: "italic", fontWeight: 500, color: "#3D4438" }}>
              Yosemite
            </em>
            ,{" "}
            <em className="font-heading" style={{ fontStyle: "italic", fontWeight: 500, color: "#3D4438" }}>
              Zion
            </em>{" "}
            &amp;{" "}
            <em className="font-heading" style={{ fontStyle: "italic", fontWeight: 500, color: "#3D4438" }}>
              Glacier
            </em>
          </p>

          {/* Trust row */}
          <div
            className="flex items-center justify-center"
            style={{
              gap: 18,
              marginTop: 12,
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
                <t.icon size={12} style={{ color: "#9A958C" }} strokeWidth={2.2} />
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "#9A958C",
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
              color: "#9A958C",
              textAlign: "center",
              marginTop: 14,
              opacity: 0,
              animation: `proFadeUp 500ms ${EASE} 1580ms both`,
            }}
          >
            <button
              onClick={() => setRefundOpen(true)}
              className="underline underline-offset-2 transition-colors hover:text-foreground"
              style={{ color: "#9A958C", fontSize: 12 }}
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
