import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Crown, ArrowRight, Loader2, Check, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const freeFeatures = ["Track 1 permit", "Email alerts", "Standard scanning"];
const proFeatures = ["Unlimited permits", "SMS + email alerts", "Priority scanning"];

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [loading, setLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPro } = useProStatus();

  const handleCheckout = async () => {
    if (!user) return;
    posthog.capture("upgrade_clicked");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.error === "already_subscribed") {
        toast({ title: "🐻 Already subscribed!", description: "You're already a Pro member. Manage your subscription in Settings." });
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
        title: "🐻 Trail hiccup",
        description: "Couldn't start checkout. Please try again!",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="block p-0 gap-0 overflow-hidden border-0 max-h-[92vh] overflow-y-auto pro-modal-content"
        style={{
          maxWidth: 400,
          borderRadius: 16,
          background: "#ffffff",
          zIndex: 1000,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <motion.div
          key="offer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center text-center"
          style={{ padding: "28px 28px 28px" }}
        >
          {/* Headline */}
          <h2
            className="font-heading"
            style={{ fontSize: 21, fontWeight: 500, color: "#1a1a1a", lineHeight: 1.3 }}
          >
            Permits open.<br />Then <em>vanish</em>. Be first.
          </h2>

          {/* Subtext */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 300,
              color: "#777",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Get alerted the moment a permit opens — before anyone else.
          </p>

          {/* Plans grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              width: "100%",
              marginTop: 20,
              alignItems: "stretch",
            }}
          >
            {/* Free card */}
            <div
              className="text-left"
              style={{
                border: "0.5px solid #e8e8e8",
                borderRadius: 10,
                padding: "16px 14px",
                background: "#fafafa",
                height: "100%",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 12 }}>Free</p>
              <div className="space-y-2.5">
                {freeFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} className="shrink-0" style={{ color: "#9CA3AF" }} />
                    <span style={{ fontSize: 11, color: "#666" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro card */}
            <div
              className="text-left relative"
              style={{
                border: "1.5px solid rgba(47,111,78,0.7)",
                borderRadius: 10,
                padding: "16px 14px",
                background: "rgba(47,110,76,0.04)",
                height: "100%",
              }}
            >
              {/* Recommended badge */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: -10,
                  background: "#2F6F4E",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  padding: "3px 10px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                }}
              >
                RECOMMENDED
              </div>

              <p style={{ fontSize: 14, fontWeight: 500, color: "#2f6e4c", marginBottom: 12, marginTop: 4 }}>Pro</p>
              <div className="space-y-2.5">
                {proFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} className="shrink-0" style={{ color: "#2f6e4c" }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a" }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Price */}
              <div
                style={{
                  borderTop: "0.5px solid rgba(47,110,76,0.15)",
                  marginTop: 14,
                  paddingTop: 12,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 2,
                }}
              >
                <span className="font-heading" style={{ fontSize: 22, fontWeight: 500, color: "#1a1a1a" }}>$9.99</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: "#999" }}>/ month</span>
              </div>
            </div>
          </div>

          {/* CTA button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={handleCheckout}
            disabled={loading || isPro}
            className="flex items-center justify-center gap-2 disabled:opacity-60 text-white transition-colors"
            style={{
              width: "100%",
              padding: 13,
              background: "linear-gradient(180deg, #2f6e4c 0%, #2d6848 40%, #24503a 100%)",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              marginTop: 20,
              cursor: loading || isPro ? "default" : "pointer",
              border: "1px solid rgba(0,0,0,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.06), 0 12px 32px rgba(47,111,78,0.28), 0 3px 6px rgba(0,0,0,0.06)",
              transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
            }}
            onMouseEnter={(e) => { if (!loading && !isPro) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.04)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Opening checkout…
              </>
            ) : isPro ? (
              <>
                <Crown size={15} />
                You're already Pro!
              </>
            ) : (
              <>
                Upgrade to Pro
                <ArrowRight size={14} />
              </>
            )}
          </motion.button>

          {/* Trust row */}
          <div className="flex items-center justify-center gap-5" style={{ marginTop: 16, flexWrap: "nowrap" }}>
            {[
              { icon: Lock, label: "Secure payment" },
              { icon: RefreshCw, label: "Cancel anytime" },
              { icon: ShieldCheck, label: "No hidden fees" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
                <t.icon size={10} className="shrink-0" style={{ color: "#aaa" }} strokeWidth={2.5} />
                <span style={{ fontSize: 10, color: "#aaa" }}>{t.label}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p style={{ fontSize: 11, color: "#ccc", marginTop: 12, textAlign: "center" }}>
            Cancel from Settings anytime ·{" "}
            <button
              onClick={() => setRefundOpen(true)}
              className="underline underline-offset-2 transition-colors hover:text-foreground"
              style={{ color: "#aaa", fontSize: 11 }}
            >
              Refund Policy
            </button>
          </p>

          {/* Refund Policy Modal */}
          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogContent className="max-w-sm rounded-2xl p-6">
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
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ProModal;
