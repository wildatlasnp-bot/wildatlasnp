import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, MapPin, Crown, ArrowRight, Loader2, Check, Gauge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  {
    icon: Zap,
    title: "Unlimited Watches",
    description: "Monitor every permit type at once — never miss a cancellation drop.",
  },
  {
    icon: Bell,
    title: "Instant SMS Alerts",
    description: "Get a text the second a permit opens — before anyone else.",
  },
  {
    icon: Gauge,
    title: "Priority Scanning",
    description: "Fastest notification speed with priority queue processing.",
  },
  {
    icon: MapPin,
    title: "Multi-Park Coverage",
    description: "Watch permits across Yosemite, Rainier, Zion, and every park we add.",
  },
];

const freeFeatures = ["1 permit watch", "Email alerts", "Standard scanning"];
const proFeatures = ["Unlimited watches", "SMS alerts", "Priority scanning", "Faster notifications"];

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPro } = useProStatus();

  const handleCheckout = async () => {
    if (!user) return;
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
          <div className="relative bg-primary px-6 pt-8 pb-10 text-center overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/5" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-primary-foreground/5" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="relative z-10"
            >
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Crown size={26} className="text-secondary-foreground" />
              </div>
              <h2 className="text-xl font-heading font-bold text-primary-foreground">WildAtlas Pro</h2>
              <p className="text-sm text-primary-foreground/75 mt-1 font-medium">Unlimited watches · All parks</p>
            </motion.div>
          </div>

          {/* Plan Comparison */}
          <div className="px-6 py-5 grid grid-cols-2 gap-3">
            {/* Free column */}
            <div className="bg-muted/40 rounded-xl p-4 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Free Plan</p>
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
            <div className="bg-secondary/8 rounded-xl p-4 border-[1.5px] border-secondary/25">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-3">Pro Plan</p>
              <div className="space-y-2.5">
                {proFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={11} className="text-secondary shrink-0" />
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

          {/* Feature details */}
          <div className="px-6 py-4 space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/8 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon size={17} strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[13px] font-semibold text-foreground">{f.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Spacer before CTA */}
          <div className="pb-1" />

          <div className="px-6 pb-6 space-y-3">
            <button
              onClick={handleCheckout}
              disabled={loading || isPro}
              className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
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
                  Upgrade to Pro — $9.99/mo
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
              Cancel anytime. You'll be redirected to a secure Stripe checkout.
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ProModal;
