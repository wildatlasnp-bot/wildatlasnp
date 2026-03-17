import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
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

const freeFeatures = ["Track 1 permit", "Email alerts"];
const proFeatures = ["Unlimited permit tracking", "SMS alerts", "Multi-park coverage"];

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
          maxWidth: 420,
          borderRadius: 18,
          background: "#FFFFFF",
          zIndex: 1000,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 32, paddingRight: 32, paddingTop: 28, paddingBottom: 28, marginLeft: "auto", marginRight: "auto" }}>
          {/* Crown icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="text-center w-full"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
              style={{ background: "#2a5c2a", marginBottom: 10 }}
            >
              <Crown size={26} className="text-white" />
            </div>
            <h2 className="font-heading" style={{ color: "#111111", fontSize: 22, fontWeight: 600 }}>Get the permits that sell out in minutes</h2>
            <p className="font-medium leading-snug max-w-[280px] mx-auto" style={{ marginTop: 6, color: "#374151", fontSize: 15, lineHeight: 1.5 }}>Our scanner checks permits continuously and alerts you instantly when one opens.</p>
          </motion.div>

          {/* Pricing Panel */}
          <div
            className="flex items-stretch"
            style={{ marginTop: 20, gap: 16, width: "100%", justifyContent: "center", alignSelf: "center", marginLeft: 0, marginRight: 0, boxSizing: "border-box" }}
          >
            {/* Free column */}
            <div
              className="rounded-[14px] flex-1 text-left"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", padding: 18 }}
            >
              <p className="text-[15px] font-semibold text-muted-foreground mb-3">Free</p>
              <div className="space-y-2.5">
                {freeFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} className="shrink-0" style={{ color: "#9aa39a" }} />
                    <span className="text-[11px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Pro column */}
            <div
              className="rounded-[14px] flex-1 text-left"
              style={{
                border: "1.5px solid rgba(42,92,42,0.35)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                background: "#FFFFFF",
                padding: 18,
              }}
            >
              <p className="text-[15px] font-semibold mb-3" style={{ color: "#2a5c2a" }}>Pro</p>
              <div className="space-y-2.5">
                {proFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} style={{ color: "#2a5c2a" }} className="shrink-0" />
                    <span className="text-[11px] text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Value callout */}
          <div
            className="flex items-center justify-center"
            style={{
              width: "100%",
              boxSizing: "border-box",
              alignSelf: "center",
              marginLeft: 0,
              marginRight: 0,
              background: "rgba(42,92,42,0.08)",
              border: "0.5px solid rgba(42,92,42,0.2)",
              borderRadius: 10,
              padding: "10px 14px",
              marginTop: 14,
              marginBottom: 18,
              fontSize: 14,
              fontWeight: 500,
              color: "#2a5c2a",
              gap: 6,
            }}
          >
            Pro: priority scanning · Free: standard scanning
          </div>

          {/* CTA button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={handleCheckout}
            disabled={loading || isPro}
            className="font-semibold text-[15px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 text-white"
            style={{
              width: "100%",
              boxSizing: "border-box",
              alignSelf: "center",
              marginLeft: 0,
              marginRight: 0,
              marginTop: 20,
              height: 52,
              background: "#2a5c2a",
              borderRadius: 12,
              boxShadow: "none",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Opening checkout…
              </>
            ) : isPro ? (
              <>
                <Crown size={16} />
                You're already Pro!
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Upgrade to Pro — $9.99/month
              </>
            )}
          </motion.button>

          {/* Trust icons row */}
          <div className="flex items-center justify-center gap-5" style={{ marginTop: 14, width: "100%", alignSelf: "center", marginLeft: 0, marginRight: 0, boxSizing: "border-box" }}>
            {[
              { icon: Lock, label: "Secure payment" },
              { icon: RefreshCw, label: "Cancel anytime" },
              { icon: ShieldCheck, label: "No hidden fees" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <t.icon size={12} className="shrink-0" style={{ color: "#4B5563" }} strokeWidth={2.5} />
                <span style={{ fontSize: 13, color: "#4B5563" }} className="font-medium">{t.label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4" style={{ marginTop: 8 }}>
            You can cancel your Pro subscription at any time from Settings with one tap.
          </p>

          <button
            onClick={() => setRefundOpen(true)}
            className="block mx-auto text-[10px] underline underline-offset-2 hover:text-foreground transition-colors"
            style={{ marginTop: 8, color: "rgba(0,0,0,0.55)" }}
          >
            Refund Policy
          </button>

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
