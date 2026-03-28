import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Phone, Crosshair, Map, Lock, Bell, XCircle, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import PhoneVerifyStep from "@/components/onboarding/PhoneVerifyStep";
import posthog from "@/lib/posthog";

interface Props {
  onComplete: (initialTab?: "sniper" | "mochi" | "discover") => void;
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
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const hasPhone = isValidUSPhone(phone);
  const TOTAL_STEPS = hasPhone ? BASE_STEPS + 1 : BASE_STEPS;
  // Steps: 0=intent, 1=phone, [2=verify if phone], live, push-notif
  const VERIFY_STEP = hasPhone ? 2 : -1;
  const PUSH_STEP = hasPhone ? 3 : 2;
  const LIVE_STEP = TOTAL_STEPS - 1;

  const canProceed =
    step === 0 ? (!!intent && ageConfirmed) :
    step === 1 ? (phone.length === 0 || isValidUSPhone(phone)) :
    true;

  const finish = async () => {
    setSaving(true);
    try {
      const e164Phone = toE164(phone);

      // Save phone number if provided
      if (e164Phone) {
        const { error: phoneError } = await supabase
          .from("profiles")
          .update({
            phone_number: e164Phone,
            sms_consent_at: new Date().toISOString(),
            sms_consent_version: "v1-2026-03",
          })
          .eq("user_id", userId);
        if (phoneError) {
          console.error("[onboarding] phone save error:", phoneError.message, phoneError.code);
          toast({
            title: "Couldn't save your profile",
            description: "Something went wrong saving your info. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // Mark onboarding complete via security-definer RPC (bypasses RLS lock on onboarded_at)
      const { error: completeError } = await supabase.rpc("complete_onboarding", { p_user_id: userId });
      if (completeError) {
        console.error("[onboarding] complete_onboarding RPC error:", completeError.message, completeError.code);
        toast({
          title: "Couldn't save your profile",
          description: "Something went wrong saving your info. Please try again.",
          variant: "destructive",
        });
        return;
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
      localStorage.setItem("wildatlas_open_add_permit", "true");
      onComplete(intent === "planning" ? "discover" : "sniper");
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
    setStep(LIVE_STEP);
    persistStep(LIVE_STEP);
  };

  const persistStep = (newStep: number) => {
    supabase.rpc("update_onboarding_step", { p_user_id: userId, p_step: newStep }).then(({ error }) => { if (error) console.error("Step persist error:", error); });
  };

  const next = () => {
    const newStep = step + 1;
    if (newStep <= LIVE_STEP) {
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
              <StepBadge number={1} total={TOTAL_STEPS} />
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
                  {([
                    { key: "permits" as const, icon: Crosshair, title: "I need a specific permit", desc: "Track cancellations and get alerts" },
                    { key: "planning" as const, icon: Map, title: "I'm planning a park visit", desc: "Get trail info, crowds, and tips" },
                  ]).map(({ key, icon: Icon, title, desc }) => (
                    <button
                      key={key}
                      onClick={() => { navigator.vibrate?.(10); setIntent(key); }}
                      className={cn(
                        "w-full relative flex flex-col items-center gap-3 rounded-2xl px-6 py-[24px] transition-all duration-150 ease-out",
                        intent !== key && "hover:bg-muted"
                      )}
                      style={{
                        transform: intent === key ? "scale(1.02)" : "scale(1)",
                        boxShadow: intent === key ? "0 4px 16px rgba(47,111,78,0.12)" : "none",
                        border: intent === key ? "1.5px solid #2F6F4E" : "2px solid var(--border)",
                        backgroundColor: intent === key ? "#F0F6F2" : undefined,
                      }}
                    >
                      {intent === key && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
                          <CheckCircle2 size={18} color="#2F6F4E" />
                        </motion.div>
                      )}
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-neutral-warm text-primary">
                        <Icon size={26} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-foreground">{title}</p>
                        <p className="text-[15px] leading-[1.5] text-muted-foreground mt-1">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Age gate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, padding: '0 4px' }}>
                  <input
                    type="checkbox"
                    id="age-confirm-onboarding"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#2F6F4E', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <label
                    htmlFor="age-confirm-onboarding"
                    style={{ fontSize: 13, color: '#6B7B6A', cursor: 'pointer', lineHeight: 1.5 }}
                  >
                    I confirm I am 13 years of age or older
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Enter phone */}
          {step === 1 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={2} total={TOTAL_STEPS} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                Add your phone number (optional)
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Add your number now — SMS alerts activate when you upgrade to Pro.
              </p>
              <div className="mt-8">
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formatPhoneDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                    className="w-full pl-11 pr-4 py-4 rounded-xl border border-border bg-card text-foreground text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                    maxLength={16}
                  />
                </div>
                {phone.length > 0 && !isValidUSPhone(phone) && (
                  <p className="text-[11px] text-destructive mt-1 px-1">
                    Enter a valid 10-digit US phone number.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed mt-3 px-1">
                  By entering your number, you agree to receive automated permit alert text messages from WildAtlas. Message frequency varies based on permit availability. Msg &amp; data rates may apply. Consent is not a condition of purchase. Reply STOP to cancel. Reply HELP for help.
                </p>
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
          {step === VERIFY_STEP && hasPhone && toE164(phone) && (
            <PhoneVerifyStep
              phone={toE164(phone)!}
              displayPhone={formatPhoneDisplay(phone)}
              userId={userId}
              onVerified={async () => {
                await supabase
                  .from("profiles")
                  .update({ phone_number: toE164(phone) })
                  .eq("user_id", userId);
                setPhoneVerified(true);
                persistStep(LIVE_STEP);
                setStep(LIVE_STEP);
              }}
              onSkip={() => { persistStep(LIVE_STEP); setStep(LIVE_STEP); }}
              stepBadge={<StepBadge number={3} total={TOTAL_STEPS} />}
            />
          )}

          {/* Final step: You're all set */}
          {step === LIVE_STEP && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="mb-4" style={{ transform: 'translateX(48px)' }}>
                  <motion.img
                    src="/mochi-flag-step4.png"
                    alt="Mochi celebrating with flag"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, delay: 0.1 }}
                    className="w-24 h-24 object-contain"
                  />
                </div>
              <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
                You're all set.
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px]">
                Head to the Alerts tab to add your first permit tracker. Mochi will start scanning the moment you do.
              </p>
              </div>
            </div>
          )}

          {step === PUSH_STEP && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={PUSH_STEP + 1} total={TOTAL_STEPS} />
              <div className="flex-1 flex flex-col items-center justify-center text-center">
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

                <div className="mt-8 w-full space-y-3">
                  <button
                    onClick={requestPushPermission}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-[15px] py-4 rounded-xl text-primary-foreground bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all"
                  >
                    <Bell size={18} />
                    Turn on notifications
                  </button>
                  <button
                    onClick={() => { setStep(LIVE_STEP); persistStep(LIVE_STEP); }}
                    className="w-full flex items-center justify-center gap-2 text-muted-foreground font-medium text-[14px] py-3 rounded-xl hover:bg-muted transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </div>

              {/* Bottom nav for push step */}
              <div className="space-y-3 mt-auto pt-4">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(step - 1)}
                    className="flex items-center justify-center w-14 shrink-0 border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors py-4"
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom nav - hide on verify step and push step (have their own nav) */}
          {step !== VERIFY_STEP && step !== PUSH_STEP && (
          <div className="px-6 pb-8 space-y-3 mt-auto pt-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
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

            {step === 1 ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(0)}
                    className="flex items-center justify-center w-14 shrink-0 border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    onClick={next}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 font-semibold text-[15px] py-4 rounded-xl transition-all text-white hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: '#2F6F4E' }}
                  >
                    {saving ? "Saving..." : phone.length === 0 ? "Skip for now" : "Save number →"}
                  </button>
                </div>
              </div>
            ) : (
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
                onClick={step === 0 ? () => { if (intent && ageConfirmed) { setStep(1); persistStep(1); } } : next}
                disabled={!canProceed || saving}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 font-semibold text-[15px] py-4 rounded-xl transition-colors",
                  step === 0 && !intent
                    ? "cursor-not-allowed"
                    : "hover:opacity-90 active:scale-[0.98]"
                )}
                style={{
                  backgroundColor: step === 0 && (!intent || !ageConfirmed) ? '#D1D5DB' : '#2F6F4E',
                  transition: 'background-color 200ms ease-in',
                  color: step === 0 && (!intent || !ageConfirmed) ? '#888' : '#fff',
                }}
              >
                {saving
                  ? "Setting up..."
                  : step === 0 ? "Set My Goal"
                  : step === LIVE_STEP ? (intent === "planning" ? "Explore parks →" : "Add my first permit →")
                  : "Next: Enable Alerts"}
                {!saving && step !== LIVE_STEP && <ArrowRight size={16} />}
              </button>
            </div>
            )}



          </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const ProgressTrack = ({ current, total }: { current: number; total: number }) => (
  <div className="px-7 pt-7">
    <p
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10,
        fontWeight: 400,
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: 'var(--wa-ink-muted)',
        margin: 0,
      }}
    >
      Step {current + 1} of {total}
    </p>
    <div className="flex gap-1 mt-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            height: 1.5,
            borderRadius: 1,
            backgroundColor: i <= current ? 'var(--wa-green)' : 'var(--wa-rule)',
            transition: 'background-color 0.4s ease',
          }}
        />
      ))}
    </div>
  </div>
);

export default OnboardingFlow;
