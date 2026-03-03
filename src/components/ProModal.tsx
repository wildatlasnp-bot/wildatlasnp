import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, MapPin, Crown, Sparkles, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  {
    icon: Zap,
    title: "60-Second Permit Refresh",
    description: "Never miss a cancellation. We scan Recreation.gov faster than anyone.",
  },
  {
    icon: Bell,
    title: "Instant SMS & Push Notifications",
    description: "Get alerted the moment a permit or campsite opens up.",
  },
  {
    icon: MapPin,
    title: "Exclusive '5 AM Early Bird' Parking Map",
    description: "Insider parking intel so you're trailhead-ready before dawn.",
  },
];

const ProModal = ({ open, onOpenChange }: ProModalProps) => {
  const [yearly, setYearly] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleWaitlist = async () => {
    if (!user?.email || !user?.id) return;
    setJoining(true);

    const { error } = await supabase
      .from("pro_waitlist")
      .upsert(
        { user_id: user.id, email: user.email },
        { onConflict: "email" }
      );

    setJoining(false);

    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }

    setJoined(true);
  };

  const handleClose = (val: boolean) => {
    if (!val) setJoined(false);
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl max-h-[92vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {joined ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 py-14 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground">
                You're on the list, Ranger!
              </h2>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
                We'll notify you the moment the 60-second Permit Sniper goes live.
              </p>
              <button
                onClick={() => handleClose(false)}
                className="mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Back to Pathfinder
              </button>
            </motion.div>
          ) : (
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
                  <h2 className="text-xl font-heading font-bold text-primary-foreground">Pathfinder Pro</h2>
                  <p className="text-sm text-primary-foreground/75 mt-1 font-medium">Yosemite Master Edition</p>
                </motion.div>
              </div>

              {/* Features */}
              <div className="px-6 py-5 space-y-4">
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
                    <div>
                      <h3 className="text-[13px] font-semibold text-foreground">{f.title}</h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{f.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pricing toggle */}
              <div className="px-6 pb-4">
                <div className="bg-muted/60 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className={`text-xs font-semibold transition-colors ${!yearly ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
                    <Switch checked={yearly} onCheckedChange={setYearly} />
                    <span className={`text-xs font-semibold transition-colors ${yearly ? "text-foreground" : "text-muted-foreground"}`}>Yearly</span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={yearly ? "year" : "month"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="text-center"
                    >
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-heading font-bold text-foreground">{yearly ? "$49.99" : "$9.99"}</span>
                        <span className="text-xs text-muted-foreground font-medium">/{yearly ? "year" : "month"}</span>
                      </div>
                      {yearly && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="inline-block mt-1.5 text-[10px] font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full uppercase tracking-wider"
                        >
                          Save 60%
                        </motion.span>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Beta CTA */}
              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={handleWaitlist}
                  disabled={joining}
                  className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  {joining ? "Joining…" : "Join the Waitlist"}
                </button>
                <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
                  Pathfinder is currently in <span className="font-semibold">Private Beta</span>. Click above to join the waitlist for early access!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default ProModal;
