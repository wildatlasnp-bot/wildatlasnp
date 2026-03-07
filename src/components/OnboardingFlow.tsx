import { useState, useEffect } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Phone, Zap, Mountain, Crosshair, Map, Lock, Bell, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ALL_PARK_IDS, PARKS, getPermitIcon } from "@/lib/parks";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import PhoneVerifyStep from "@/components/onboarding/PhoneVerifyStep";

interface Props {
  onComplete: (initialTab?: "sniper" | "mochi") => void;
  userId: string;
}

interface PermitOption {
  name: string;
  description: string | null;
}

const BASE_STEPS = 5;
const INTENT_KEY = "wildatlas_user_intent";

const OnboardingFlow = ({ onComplete, userId }: Props) => {
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<"permits" | "planning" | null>(null);
  const [selectedPark, setSelectedPark] = useState(ALL_PARK_IDS[0]);
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);
  const [permitOptions, setPermitOptions] = useState<PermitOption[]>([]);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const hasPhone = isValidUSPhone(phone);
  const TOTAL_STEPS = hasPhone ? BASE_STEPS + 1 : BASE_STEPS;
  // Steps: 0=intent, 1=park, 2=permits, 3=phone, [4=verify if phone], last=live
  const VERIFY_STEP = hasPhone ? 4 : -1;
  const LIVE_STEP = TOTAL_STEPS - 1;

  // Load permits when park is selected (step 1)
  useEffect(() => {
    if (step < 2) return;
    supabase
      .from("park_permits")
      .select("name, description")
      .eq("park_id", selectedPark)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPermitOptions(data);
          setSelectedPermits([data[0].name]);
        } else {
          setPermitOptions([]);
          setSelectedPermits([]);
        }
      });
  }, [selectedPark, step]);

  // Free users can only select 1 permit during onboarding
  const togglePermit = (name: string) => {
    setSelectedPermits((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [name]
    );
  };

  const canProceed =
    step === 0 ? !!intent :
    step === 1 ? !!selectedPark :
    step === 2 ? selectedPermits.length > 0 :
    step === 3 ? (phone.length === 0 || isValidUSPhone(phone)) :
    true;

  const finish = async () => {
    setSaving(true);
    try {
      const e164Phone = toE164(phone);
      for (const permitName of selectedPermits) {
        const { data } = await supabase
          .from("active_watches")
          .select("id")
          .eq("user_id", userId)
          .eq("permit_name", permitName)
          .eq("park_id", selectedPark)
          .maybeSingle();
        if (!data) {
          await supabase.from("active_watches").insert({
            user_id: userId,
            permit_name: permitName,
            park_id: selectedPark,
            is_active: true,
            status: "searching",
            notify_sms: phoneVerified,
          });
        }
      }
      if (e164Phone) {
        await supabase
          .from("profiles")
          .update({ phone_number: e164Phone, onboarded_at: new Date().toISOString() })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("profiles")
          .update({ onboarded_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
      localStorage.setItem("wildatlas_active_park", selectedPark);
      localStorage.setItem(INTENT_KEY, intent ?? "permits");

      // Store first-session context for Mochi's personalized welcome (one-time)
      localStorage.setItem("wildatlas_first_session", JSON.stringify({
        parkId: selectedPark,
        parkName: PARKS[selectedPark]?.shortName || selectedPark,
        permitName: selectedPermits[0] || "",
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
            permitName: selectedPermits[0] || "",
            parkName: PARKS[selectedPark]?.shortName || selectedPark,
            phone: e164Phone || "",
          },
        }).catch((err) => console.error("Welcome email failed:", err));
      }

      onComplete(intent === "planning" ? "mochi" : "sniper");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  };

  const parkConfig = PARKS[selectedPark];

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
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="text-[42px] leading-none mb-4"
                >
                  🐻
                </motion.div>
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
                        ? "bg-secondary/10 border-secondary/40"
                        : "bg-card border-border hover:bg-muted hover:border-border/80"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      intent === "permits" ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
                    )}>
                      <Crosshair size={26} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-foreground">I need a specific permit</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Track cancellations and get alerts</p>
                    </div>
                    {intent === "permits" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <Check size={14} className="text-secondary-foreground" />
                      </motion.div>
                    )}
                  </button>

                  <button
                    onClick={() => setIntent("planning")}
                    className={cn(
                      "w-full flex flex-col items-center gap-3 rounded-2xl p-6 border-2 transition-all",
                      intent === "planning"
                        ? "bg-secondary/10 border-secondary/40"
                        : "bg-card border-border hover:bg-muted hover:border-border/80"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      intent === "planning" ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
                    )}>
                      <Map size={26} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-foreground">I'm planning a park visit</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Get trail info, crowds, and tips</p>
                    </div>
                    {intent === "planning" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <Check size={14} className="text-secondary-foreground" />
                      </motion.div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Pick park */}
          {step === 1 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={1} total={TOTAL_STEPS - 1} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                Where are you headed?
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Pick your park. You can always add more later.
              </p>
              <div className="mt-6 space-y-3 flex-1">
                {ALL_PARK_IDS.map((id) => {
                  const park = PARKS[id];
                  const selected = selectedPark === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedPark(id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl p-4 border transition-all text-left",
                        selected
                          ? "bg-secondary/10 border-secondary/30"
                          : "bg-card border-border hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        selected ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
                      )}>
                        <Mountain size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-foreground">{park.shortName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{park.region} · {park.heroDescription}</p>
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0"
                        >
                          <Check size={14} className="text-secondary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Pick permits */}
          {step === 2 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={2} total={TOTAL_STEPS - 1} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                What permits do you need?
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Pick one permit to track.
              </p>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-muted border border-border text-[11px] text-muted-foreground font-medium">
                Free plan · 1 permit tracker
                <span className="text-secondary font-semibold">Upgrade for unlimited</span>
              </div>
              <div className="mt-6 space-y-3 flex-1">
                {permitOptions.map((permit) => {
                  const Icon = getPermitIcon(permit.name);
                  const selected = selectedPermits.includes(permit.name);
                  return (
                    <button
                      key={permit.name}
                      onClick={() => togglePermit(permit.name)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl p-4 border transition-all text-left",
                        selected
                          ? "bg-secondary/10 border-secondary/30"
                          : "bg-card border-border hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        selected ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
                      )}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-foreground">{permit.name}</p>
                        {permit.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{permit.description}</p>
                        )}
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0"
                        >
                          <Check size={14} className="text-secondary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Enter phone */}
          {step === 3 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={3} total={TOTAL_STEPS - 1} />
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
                  US numbers only (10 digits). SMS alerts require a Pro plan. You can add this later in Settings.
                </p>
                {phone.length > 0 && !isValidUSPhone(phone) && (
                  <p className="text-[11px] text-destructive mt-1 px-1">
                    Enter a valid 10-digit US phone number.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-3 px-1 text-center leading-relaxed">
                  By entering your number, you consent to receive automated permit alert text messages from WildAtlas.
                  <br />
                  Message frequency varies based on permit availability. Message &amp; data rates may apply.
                  <br />
                  Reply STOP at any time to unsubscribe. Reply HELP for help.
                  <br />
                  See our{" "}
                  <a href="https://wildatlasnp-bot.github.io/wildatlas-legal/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">Privacy Policy</a>.
                </p>
                <Collapsible className="mt-2 px-1">
                  <CollapsibleTrigger className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground underline transition-colors mx-auto block">
                    SMS Terms
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                      By entering your number, you consent to receive automated permit alert text messages from WildAtlas. Message frequency varies based on permit availability. Message &amp; data rates may apply. Reply STOP at any time to unsubscribe. Reply HELP for help.
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
                      <a href="/terms" target="_blank" className="underline hover:text-muted-foreground transition-colors">Terms of Service</a>
                      <span className="mx-1.5">·</span>
                      <a href="https://wildatlasnp-bot.github.io/wildatlas-legal/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">Privacy Policy</a>
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
                    <Icon size={14} className="text-secondary shrink-0" />
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
                setStep(LIVE_STEP);
              }}
              onSkip={() => setStep(LIVE_STEP)}
            />
          )}

          {/* Final step: You're live */}
          {step === LIVE_STEP && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-secondary/15 flex items-center justify-center mb-6"
              >
                <Zap size={36} className="text-secondary" />
              </motion.div>
              <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
                You're live.
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px]">
                Mochi 🐻 is now scanning {parkConfig?.shortName} for{" "}
                <span className="font-medium text-foreground">
                  {selectedPermits.length} permit{selectedPermits.length !== 1 ? "s" : ""}
                </span>{" "}
                as often as every 2 minutes.
              </p>
              <div className="mt-6 space-y-1.5">
                {selectedPermits.map((name) => {
                  const Icon = getPermitIcon(name);
                  return (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-[13px] text-muted-foreground"
                    >
                      <Icon size={14} className="text-secondary" />
                      <span>{name}</span>
                      <span className="text-secondary font-medium">· Scanning</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom nav - hide on verify step (has its own nav) */}
          {step !== VERIFY_STEP && (
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
              {step > 0 && step !== 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center justify-center w-14 shrink-0 border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button
                onClick={step === 0 ? () => { if (intent) setStep(1); } : next}
                disabled={!canProceed || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? "Setting up..." : step === LIVE_STEP ? "Go to Dashboard" : step === 3 && !phone ? "Skip for now" : "Continue"}
                {!saving && <ArrowRight size={16} />}
              </button>
            </div>

            {step === LIVE_STEP && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <a href="/terms" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Terms</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/privacy" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Privacy</a>
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
