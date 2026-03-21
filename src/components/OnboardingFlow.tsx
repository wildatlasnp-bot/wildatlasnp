import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Phone, Zap, Crosshair, Map, Lock, Bell, XCircle, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import PhoneVerifyStep from "@/components/onboarding/PhoneVerifyStep";
import posthog from "@/lib/posthog";

interface Props {
  onComplete: (initialTab?: "sniper" | "mochi") => void;
  userId: string;
  initialStep?: number;
}

const BASE_STEPS = 4; // intent, phone, live, push-notif
const INTENT_KEY = "wildatlas_user_intent";

const OnboardingFlow = ({ onComplete, userId, initialStep = 0 }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(() => {
    // Clamp initialStep to valid range for new flow (old steps 1/2 were park/permit)
    const clamped = Math.min(initialStep, 0);
    if (clamped === 0) posthog.capture("onboarding_started");
    else posthog.capture("onboarding_resumed", { step: clamped });
    return clamped;
  });
  const [intent, setIntent] = useState<"permits" | "planning" | null>(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const hasPhone = isValidUSPhone(phone);
  const TOTAL_STEPS = hasPhone ? BASE_STEPS + 1 : BASE_STEPS;
  // Steps: 0=intent, 1=phone, [2=verify if phone], live, push-notif
  const VERIFY_STEP = hasPhone ? 2 : -1;
  const LIVE_STEP = hasPhone ? 3 : 2;
  const PUSH_STEP = TOTAL_STEPS - 1;

  const canProceed =
    step === 0 ? !!intent :
    step === 1 ? (phone.length === 0 || isValidUSPhone(phone)) :
    true;

  const finish = async () => {
    setSaving(true);
    try {
      const e164Phone = toE164(phone);

      if (e164Phone) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone_number: e164Phone, onboarded_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (profileError) {
          toast({
            title: "Couldn't save your profile",
            description: "Something went wrong saving your info. Please try again.",
            variant: "destructive",
          });
          return;
        }
      } else {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ onboarded_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (profileError) {
          toast({
            title: "Couldn't save your profile",
            description: "Something went wrong saving your info. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }
      localStorage.setItem(INTENT_KEY, intent ?? "permits");

      // Store first-session context for Mochi's personalized welcome (one-time)
      localStorage.setItem("wildatlas_first_session", JSON.stringify({
        parkId: "",
        parkName: "",
        permitName: "",
        phone: phone ? toE164(phone) || "" : "",
      }));

      // Fire personalized welcome email (non-blocking)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        const displayName = userData.user.user_metadata?.full_name
          || userData.user.user_metadata?.name
          || userData.user.email?.split("@")[0]
          || "";
        const firstName = displayName.split(" ")[0];

        supabase.functions.invoke("send-welcome-email", {
          body: {
            email: userData.user.email,
            firstName,
            permitName: "",
            parkName: "",
            phone: e164Phone || "",
          },
        }).catch((err) => console.error("Welcome email failed:", err));
      }

      posthog.capture("onboarding_completed");
      onComplete(intent === "planning" ? "mochi" : "sniper");
    } finally {
      setSaving(false);
    }
  };

  const requestPushPermission = async () => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        const result = await Notification.requestPermission();
        localStorage.setItem("wildatlas_push_permission", result);
        if (result === "granted") {
          posthog.capture("push_notifications_enabled");
        }
      }
    } catch (e) {
      console.error("Push permission error:", e);
    }
    const i = localStorage.getItem(INTENT_KEY);
    onComplete(i === "planning" ? "mochi" : "sniper");
  };

  const persistStep = (newStep: number) => {
    supabase.rpc("update_onboarding_step", { p_user_id: userId, p_step: newStep }).then(({ error }) => { if (error) console.error("Step persist error:", error); });
  };

  const next = () => {
    const newStep = step + 1;
    if (newStep <= PUSH_STEP) {
      setStep(newStep);
      persistStep(newStep);
    } else {
      finish();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex-1 flex flex-col"
        >
          {/* Step 0: Intent */}
          {step === 0 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <motion.img
                  src="/mochi-walking.png"
                  alt="Mochi walking"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-24 h-24 object-contain mb-4"
                />
                <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
                  What brings you to WildAtlas?
                </h1>
                <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px]">
                  This helps us set up the right experience for you.
                </p>

                <div className="mt-8 w-full space-y-3">
                  <button
                    onClick={() => setIntent("permits")}
                    className={cn(
                      "w-full flex flex-col items-center gap-3 rounded-2xl p-6 border-2 transition-all",
                      intent === "permits"
                        ? "bg-primary/8 border-primary/30"
                        : "bg-card border-border hover:bg-muted hover:border-border/80"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      "bg-[#F0EDEA] text-primary"
                    )}>
                      <Crosshair size={26} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-foreground">I need a specific permit</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Track cancellations and get alerts</p>
                    </div>
                    {intent === "permits" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </button>

                  <button
                    onClick={() => setIntent("planning")}
                    className={cn(
                      "w-full flex flex-col items-center gap-3 rounded-2xl p-6 border-2 transition-all",
                      intent === "planning"
                        ? "bg-primary/8 border-primary/30"
                        : "bg-card border-border hover:bg-muted hover:border-border/80"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      "bg-[#F0EDEA] text-primary"
                    )}>
                      <Map size={26} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-foreground">I'm planning a park visit</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Get trail info, crowds, and tips</p>
                    </div>
                    {intent === "planning" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Enter phone */}
          {step === 1 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={1} total={TOTAL_STEPS - 1} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                Add your phone number
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Optional. SMS alerts are available with a Pro subscription ($9.99/mo). You can upgrade anytime.
              </p>
              <div className="mt-8">
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formatPhoneDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                    className="w-full pl-11 pr-4 py-4 rounded-xl border border-border bg-card text-foreground text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
                    maxLength={16}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-3 px-1">
                  Phone alerts are a Pro feature. Add your number now and activate after upgrading.
                </p>
                {phone.length > 0 && !isValidUSPhone(phone) && (
                  <p className="text-[11px] text-destructive mt-1 px-1">
                    Enter a valid 10-digit US phone number.
                  </p>
                )}
                <Collapsible className="mt-3 px-1">
                  <CollapsibleTrigger className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground underline transition-colors mx-auto block">
                    SMS Terms
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                      By entering your number, you consent to receive automated permit alert text messages from WildAtlas. Message frequency varies based on permit availability. Message &amp; data rates may apply. Reply STOP at any time to unsubscribe. Reply HELP for help.
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
                      <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=c730f7d6-371c-4e8b-8d57-7577fca052d3" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">Terms of Service</a>
                      <span className="mx-1.5">·</span>
                      <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=59c2e394-d476-41da-9349-3e3c4a96f375" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">Privacy Policy</a>
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Trust reassurance items */}
              <div className="mt-8 space-y-3.5 px-1">
                {[
                  { icon: Lock, text: "Your number is never shared or sold." },
                  { icon: Bell, text: "We only text you when a permit opens." },
                  { icon: XCircle, text: "Unsubscribe anytime in Settings." },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 justify-center">
                    <Icon size={14} className="text-primary shrink-0" />
                    <span className="text-[12px] text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phone verification step */}
          {step === VERIFY_STEP && hasPhone && (
            <PhoneVerifyStep
              phone={toE164(phone)!}
              displayPhone={formatPhoneDisplay(phone)}
              userId={userId}
              onVerified={() => {
                setPhoneVerified(true);
                persistStep(LIVE_STEP);
                setStep(LIVE_STEP);
              }}
              onSkip={() => { persistStep(LIVE_STEP); setStep(LIVE_STEP); }}
            />
          )}

          {/* Final step: You're all set */}
          {step === LIVE_STEP && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-[#F0EDEA] flex items-center justify-center mb-6"
              >
                <Zap size={36} className="text-primary" />
              </motion.div>
              <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
                You're all set.
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px]">
                Head to the Alerts tab to add your first permit tracker. Mochi 🐻 will start scanning the moment you do.
              </p>
            </div>
          )}

          {/* Push notification permission step */}
          {step === PUSH_STEP && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
              >
                <BellRing size={36} className="text-primary" />
              </motion.div>
              <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
                Never miss a permit
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px]">
                Turn on notifications so we can alert you the moment a permit opens up.
              </p>

              <div className="mt-10 w-full space-y-3">
                <button
                  onClick={requestPushPermission}
                  className="w-full flex items-center justify-center gap-2 font-semibold text-[15px] py-4 rounded-xl text-primary-foreground bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all"
                >
                  <Bell size={18} />
                  Turn on notifications
                </button>
                <button
                  onClick={() => { const i = localStorage.getItem(INTENT_KEY); onComplete(i === "planning" ? "mochi" : "sniper"); }}
                  className="w-full flex items-center justify-center gap-2 text-muted-foreground font-medium text-[14px] py-3 rounded-xl hover:bg-muted transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          )}

          {/* Bottom nav - hide on verify step and push step (have their own nav) */}
          {step !== VERIFY_STEP && step !== PUSH_STEP && (
          <div className="px-6 pb-8 space-y-3 mt-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-secondary" : i < step ? "w-1.5 bg-secondary/40" : "w-1.5 bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>

            {step === LIVE_STEP && (
              <p className="text-[11px] text-muted-foreground/70 text-center mb-1">
                By continuing, you agree to the WildAtlas{" "}
                <a href="/terms" target="_blank" className="underline hover:text-muted-foreground transition-colors">
                  Terms of Service
                </a>.
              </p>
            )}

            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center justify-center w-14 shrink-0 border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button
                onClick={step === 0 ? () => { if (intent) { setStep(1); persistStep(1); } } : next}
                disabled={!canProceed || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? "Setting up..." : step === 1 && !phone ? "Skip for now" : "Continue"}
                {!saving && <ArrowRight size={16} />}
              </button>
            </div>

            {step === LIVE_STEP && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=c730f7d6-371c-4e8b-8d57-7577fca052d3" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Terms</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=59c2e394-d476-41da-9349-3e3c4a96f375" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Privacy</a>
              </div>
            )}
          </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const StepBadge = ({ number, total }: { number: number; total: number }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-semibold w-fit uppercase tracking-wider">
    Step {number} of {total}
  </div>
);

export default OnboardingFlow;
