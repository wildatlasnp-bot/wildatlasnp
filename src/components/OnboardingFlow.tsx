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
  const [intent, setIntent] = useState<"permits" | "planning" | null>("planning");
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
            <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--wa-cream)' }}>
              <ProgressTrack current={0} total={TOTAL_STEPS} />

              {/* Scrollable content */}
              <div className="flex-1 flex flex-col items-center text-center overflow-y-auto px-7" style={{ paddingBottom: 8 }}>
                {/* Mochi avatar placeholder */}
                <div
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    backgroundColor: 'var(--wa-green-light)',
                    border: '1px solid rgba(47,111,78,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 20, flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: 'italic', color: 'var(--wa-green)' }}>M</span>
                </div>

                {/* Headline + subtext */}
                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400,
                  lineHeight: 1.08, letterSpacing: '-0.01em', color: 'var(--wa-ink)', marginTop: 18,
                }}>
                  What brings you to<br />
                  <span style={{ fontStyle: 'italic', color: 'var(--wa-green)' }}>WildAtlas?</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: 'var(--wa-ink-mid)', lineHeight: 1.55, marginTop: 8,
                }}>
                  Mochi uses this to set up the right experience for you.
                </p>

                {/* Goal cards */}
                <div style={{ marginTop: 24, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { key: "permits" as const, icon: Crosshair, label: "I need a specific permit", sub: "Track cancellations · get instant alerts" },
                    { key: "planning" as const, icon: Map, label: "I'm planning a park visit", sub: "Crowd windows · trail tips · park guide" },
                  ]).map(({ key, icon: Icon, label, sub }) => {
                    const selected = intent === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { navigator.vibrate?.(10); setIntent(key); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: 16, borderRadius: 10, width: '100%',
                          background: selected ? 'var(--wa-green-light)' : 'var(--wa-white)',
                          borderTop: `1px solid ${selected ? 'rgba(47,111,78,0.35)' : 'var(--wa-rule)'}`,
                          borderRight: `1px solid ${selected ? 'rgba(47,111,78,0.35)' : 'var(--wa-rule)'}`,
                          borderBottom: `1px solid ${selected ? 'rgba(47,111,78,0.35)' : 'var(--wa-rule)'}`,
                          borderLeft: `2px solid ${selected ? '#2F6F4E' : 'transparent'}`,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Icon chip */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: selected ? 'rgba(47,111,78,0.12)' : '#F0EDEA',
                        }}>
                          <Icon size={16} strokeWidth={1.5} style={{ color: selected ? 'var(--wa-green)' : 'var(--wa-ink-muted)' }} />
                        </div>
                        {/* Copy */}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', display: 'block' }}>{label}</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: 'var(--wa-ink-muted)', marginTop: 2, display: 'block' }}>{sub}</span>
                        </div>
                        {/* Check indicator */}
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          backgroundColor: 'var(--wa-green)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: selected ? 1 : 0, transition: 'opacity 0.15s ease',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Age gate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    id="age-confirm-onboarding"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: 'var(--wa-green)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <label
                    htmlFor="age-confirm-onboarding"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: 'var(--wa-ink-muted)', cursor: 'pointer' }}
                  >
                    I confirm I am 13 years of age or older
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Enter phone */}
          {step === 1 && (
            <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--wa-cream)' }}>
              <ProgressTrack current={1} total={TOTAL_STEPS} />

              <div className="flex-1 flex flex-col overflow-y-auto px-7" style={{ paddingBottom: 8 }}>
                {/* Headline */}
                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400,
                  lineHeight: 1.08, color: 'var(--wa-ink)', marginTop: 20,
                }}>
                  Add your<br />
                  <span style={{ fontStyle: 'italic', color: 'var(--wa-green)' }}>phone number</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: 'var(--wa-ink-mid)', lineHeight: 1.55, marginTop: 8,
                }}>
                  SMS alerts activate on Pro. Save it now — skip setup later.
                </p>

                {/* Phone input */}
                <div style={{ position: 'relative', marginTop: 24 }}>
                  <Phone
                    size={15}
                    strokeWidth={1.5}
                    style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--wa-ink-muted)', pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formatPhoneDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                    maxLength={16}
                    style={{
                      width: '100%', padding: '14px 14px 14px 40px', borderRadius: 10,
                      border: '1px solid var(--wa-rule)', background: 'var(--wa-white)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400,
                      color: 'var(--wa-ink)', outline: 'none',
                      transition: 'border-color 0.18s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--wa-green)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--wa-rule)'; }}
                  />
                </div>
                {phone.length > 0 && !isValidUSPhone(phone) && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'hsl(var(--destructive))', marginTop: 4, paddingLeft: 2 }}>
                    Enter a valid 10-digit US phone number.
                  </p>
                )}

                {/* Legal text */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 300,
                  color: 'var(--wa-ink-muted)', lineHeight: 1.55, textAlign: 'center', marginTop: 12,
                }}>
                  By entering your number, you agree to receive automated permit alert texts from WildAtlas. Msg &amp; data rates may apply. Consent is not a condition of purchase. Reply STOP to cancel.
                </p>

                {/* Trust block */}
                <div style={{
                  marginTop: 20, background: 'var(--wa-white)',
                  border: '1px solid var(--wa-rule)', borderRadius: 10, overflow: 'hidden',
                }}>
                  {[
                    { icon: Lock, text: "Your number is never shared or sold" },
                    { icon: Bell, text: "We only text when a permit opens" },
                    { icon: XCircle, text: "Unsubscribe anytime in Settings" },
                  ].map(({ icon: Icon, text }, i, arr) => (
                    <div
                      key={text}
                      style={{
                        padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11,
                        borderBottom: i < arr.length - 1 ? '1px solid var(--wa-rule)' : 'none',
                      }}
                    >
                      <Icon size={13} strokeWidth={1.5} style={{ color: 'var(--wa-green)', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: 'var(--wa-ink-mid)' }}>{text}</span>
                    </div>
                  ))}
                </div>
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
              stepBadge={<ProgressTrack current={2} total={TOTAL_STEPS} />}
            />
          )}

          {/* Final step: You're all set */}
          {step === LIVE_STEP && (
            <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--wa-cream)' }}>
              <ProgressTrack current={LIVE_STEP} total={TOTAL_STEPS} />
              <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '0 28px' }}>
                {/* Mochi avatar */}
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  backgroundColor: 'var(--wa-green-light)',
                  border: '1px solid rgba(47,111,78,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20, flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontStyle: 'italic', color: 'var(--wa-green)' }}>M</span>
                </div>

                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400,
                  lineHeight: 1.05, textAlign: 'center', color: 'var(--wa-ink)',
                }}>
                  You're all set.<br />
                  <span style={{ fontStyle: 'italic', color: 'var(--wa-gold)' }}>The wild awaits.</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: 'var(--wa-ink-mid)', lineHeight: 1.55, textAlign: 'center',
                  marginTop: 8, marginBottom: 24,
                }}>
                  Mochi starts scanning the moment you add your first tracker.
                </p>

                {/* Checklist */}
                <div style={{
                  width: '100%', background: 'var(--wa-white)',
                  border: '1px solid var(--wa-rule)', borderRadius: 10, overflow: 'hidden',
                }}>
                  {["Account created", "Phone number saved", "Mochi is on standby"].map((text, i, arr) => (
                    <div key={text} style={{
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      borderBottom: i < arr.length - 1 ? '1px solid var(--wa-rule)' : 'none',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: 'var(--wa-green-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="var(--wa-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 300, color: 'var(--wa-ink-mid)' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === PUSH_STEP && (
            <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--wa-cream)' }}>
              <ProgressTrack current={PUSH_STEP} total={TOTAL_STEPS} />
              <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '0 28px' }}>
                {/* Bell icon frame */}
                <div style={{
                  width: 68, height: 68, borderRadius: 18,
                  backgroundColor: 'var(--wa-green-light)',
                  border: '1px solid rgba(47,111,78,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 22, flexShrink: 0,
                }}>
                  <Bell size={28} strokeWidth={1.5} style={{ color: 'var(--wa-green)' }} />
                </div>

                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400,
                  lineHeight: 1.08, textAlign: 'center', color: 'var(--wa-ink)',
                }}>
                  Never miss<br />
                  <span style={{ fontStyle: 'italic', color: 'var(--wa-green)' }}>a permit</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: 'var(--wa-ink-mid)', lineHeight: 1.55, textAlign: 'center',
                  marginTop: 8, marginBottom: 24,
                }}>
                  Turn on notifications. When a spot opens, Mochi tells you before anyone else sees it.
                </p>

                {/* Alert preview card */}
                <div style={{
                  width: '100%', background: 'var(--wa-white)',
                  border: '1px solid var(--wa-rule)', borderRadius: 12,
                  padding: '14px 16px', textAlign: 'left',
                }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--wa-green)', marginBottom: 5 }}>
                    WildAtlas Alert · Now
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', marginBottom: 3 }}>
                    Permit available — Half Dome cables
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: 'var(--wa-ink-muted)' }}>
                    July 14 · 2 spots remaining
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '20px 28px 36px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setStep(step - 1)}
                    style={{
                      width: 44, height: 44, minWidth: 44, flexShrink: 0,
                      background: 'transparent', border: '1px solid var(--wa-rule)',
                      borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 16,
                      color: 'var(--wa-ink-mid)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ←
                  </button>
                  <button
                    onClick={requestPushPermission}
                    style={{
                      flex: 1, padding: 15, borderRadius: 10, border: 'none',
                      backgroundColor: 'var(--wa-green)', color: 'var(--wa-cream)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      cursor: 'pointer', transition: 'background-color 200ms ease-in',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green)'; }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    TURN ON NOTIFICATIONS →
                  </button>
                </div>
                <button
                  onClick={() => { setStep(LIVE_STEP); persistStep(LIVE_STEP); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'center', marginTop: 2,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 400,
                    color: 'var(--wa-ink-muted)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '8px 0',
                  }}
                >
                  Maybe later
                </button>
              </div>
            </div>
          )}

          {/* Bottom nav - hide on verify step and push step (have their own nav) */}
          {step !== VERIFY_STEP && step !== PUSH_STEP && (
          step === 0 ? (
            /* Step 0 footer — custom styled CTA, no back button */
            <div style={{ padding: '20px 28px 36px', flexShrink: 0 }}>
              <button
                onClick={() => { if (intent && ageConfirmed) { setStep(1); persistStep(1); } }}
                disabled={!intent || !ageConfirmed}
                style={{
                  width: '100%', padding: 15, borderRadius: 10, border: 'none',
                  backgroundColor: intent ? 'var(--wa-green)' : '#D1D5DB',
                  color: intent ? 'var(--wa-cream)' : '#888',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                  letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                  cursor: intent ? 'pointer' : 'not-allowed',
                  transition: 'background-color 200ms ease-in',
                }}
                onMouseEnter={(e) => { if (intent) (e.currentTarget.style.backgroundColor = 'var(--wa-green-hover)'); }}
                onMouseLeave={(e) => { if (intent) (e.currentTarget.style.backgroundColor = 'var(--wa-green)'); }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                SET MY GOAL →
              </button>
            </div>
          ) : (
          <div style={{ flexShrink: 0 }}>

            {step === 1 ? (
              <div style={{ padding: '20px 28px 36px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setStep(0)}
                    style={{
                      width: 44, height: 44, minWidth: 44, flexShrink: 0,
                      background: 'transparent', border: '1px solid var(--wa-rule)',
                      borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 16,
                      color: 'var(--wa-ink-mid)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ←
                  </button>
                  <button
                    onClick={next}
                    disabled={saving}
                    style={{
                      flex: 1, padding: 15, borderRadius: 10, border: 'none',
                      backgroundColor: 'var(--wa-green)', color: 'var(--wa-cream)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      cursor: 'pointer', transition: 'background-color 200ms ease-in',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green)'; }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {saving ? "SAVING..." : "SAVE & CONTINUE →"}
                  </button>
                </div>
                <button
                  onClick={() => { setPhone(""); next(); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'center', marginTop: 2,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 400,
                    color: 'var(--wa-ink-muted)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '8px 0',
                  }}
                >
                  Skip for now
                </button>
              </div>
            ) : step === LIVE_STEP ? (
              <div style={{ padding: '20px 28px 36px' }}>
                <button
                  onClick={next}
                  disabled={saving}
                  style={{
                    width: '100%', padding: 15, borderRadius: 10, border: 'none',
                    backgroundColor: 'var(--wa-green)', color: 'var(--wa-cream)',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                    cursor: 'pointer', transition: 'background-color 200ms ease-in',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--wa-green)'; }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {saving ? "SETTING UP..." : "EXPLORE PARKS →"}
                </button>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 300,
                  color: 'var(--wa-ink-muted)', textAlign: 'center', lineHeight: 1.5, marginTop: 4,
                }}>
                  By continuing, you agree to the WildAtlas{" "}
                  <a href="/terms" target="_blank" style={{ color: 'var(--wa-green)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                    Terms of Service
                  </a>.
                </p>
              </div>
            ) : null}

          </div>
          )
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
