import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, MapPin, Crown, ArrowRight, Loader2, Check, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";
import posthog from "@/lib/posthog";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  {
    icon: Zap,
    title: "Unlimited Tracking",
    description: "Track every permit type at once — never miss a cancellation drop.",
  },
  {
    icon: Bell,
    title: "Instant SMS Alerts",
    description: "Get a text the moment a permit opens so you can book immediately.",
  },
  {
    icon: MapPin,
    title: "Multi-Park Coverage",
    description: "Track permits across Yosemite, Rainier, Zion, and every park we add.",
  },
];

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
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl max-h-[92vh] overflow-y-auto">
        <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* Hero header */}
          <div
            className="relative px-6 text-center overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #F0F5F0 0%, #FFFFFF 100%)",
              paddingTop: 32,
              paddingBottom: 32,
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="relative z-10"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                style={{ background: "#3D6B4F" }}
              >
                <Crown size={26} className="text-white" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground">Never miss a permit again</h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium leading-snug max-w-[280px] mx-auto">Our scanner checks permits continuously and alerts you instantly when one opens.</p>
            </motion.div>
          </div>

          {/* Plan Comparison */}
          <div className="px-6 py-5 grid grid-cols-2 gap-3 items-start">
            {/* Free column */}
            <div
              className="rounded-[16px] p-4"
              style={{ background: "#F9F9F9" }}
            >
              <p className="text-[15px] font-semibold text-muted-foreground mb-3">Free</p>
              <div className="space-y-2.5">
                {freeFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} className="text-muted-foreground/50 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Pro column */}
            <div
              className="rounded-[16px] p-4 scale-[1.03] origin-top"
              style={{
                border: "2px solid #3D6B4F",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                background: "white",
              }}
            >
              <p className="text-[15px] font-semibold text-foreground mb-3">Pro</p>
              <div className="space-y-2.5">
                {proFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} style={{ color: "#3D6B4F" }} className="shrink-0" />
                    <span className="text-[11px] text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Value statement */}
          <div className="px-6 pb-2">
             <p className="text-center text-[12px] font-semibold text-foreground">
              Pro users receive alerts faster when permits become available.
            </p>
          </div>

          <div className="px-6 pb-6 space-y-3">
            <button
              onClick={handleCheckout}
              disabled={loading || isPro}
              className="w-full py-4 rounded-xl bg-secondary text-secondary-foreground font-bold text-[15px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
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
            </button>

            {/* Trust icons row */}
            <div className="flex items-center justify-center gap-5 pt-1">
              {[
                { icon: Lock, label: "Secure payment" },
                { icon: RefreshCw, label: "Cancel anytime" },
                { icon: ShieldCheck, label: "No hidden fees" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <t.icon size={11} className="text-primary shrink-0" strokeWidth={2.5} />
                  <span className="text-[10px] text-muted-foreground font-medium">{t.label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
              You can cancel your Pro subscription at any time from Settings with one tap.
            </p>

            <button
              onClick={() => setRefundOpen(true)}
              className="block mx-auto text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Refund Policy
            </button>
          </div>

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
