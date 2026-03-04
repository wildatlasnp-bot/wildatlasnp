import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Phone, Zap, Mountain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ALL_PARK_IDS, PARKS, getPermitIcon } from "@/lib/parks";

interface Props {
  onComplete: () => void;
  userId: string;
}

interface PermitOption {
  name: string;
  description: string | null;
}

const TOTAL_STEPS = 4;

const OnboardingFlow = ({ onComplete, userId }: Props) => {
  const [step, setStep] = useState(0);
  const [selectedPark, setSelectedPark] = useState(ALL_PARK_IDS[0]);
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);
  const [permitOptions, setPermitOptions] = useState<PermitOption[]>([]);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Load permits when park is selected (step 1)
  useEffect(() => {
    if (step < 1) return;
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
    step === 0 ? !!selectedPark :
    step === 1 ? selectedPermits.length > 0 :
    step === 2 ? true :
    true;

  const finish = async () => {
    setSaving(true);
    try {
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
            status: "live",
            notify_sms: phone.length >= 10,
          });
        }
      }
      if (phone.length >= 10) {
        await supabase
          .from("profiles")
          .update({ phone_number: phone })
          .eq("user_id", userId);
      }
      localStorage.setItem("wildatlas_onboarded", "true");
      localStorage.setItem("wildatlas_active_park", selectedPark);
      onComplete();
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
          {/* Step 0: Pick park */}
          {step === 0 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={1} />
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
          {step === 1 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={2} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                What permits do you need?
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Pick one permit to watch. Upgrade to Pro for unlimited watches.
              </p>
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

          {/* Step 2: Enter phone */}
          {step === 2 && (
            <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
              <StepBadge number={3} />
              <h1 className="font-heading text-[24px] font-bold text-foreground mt-4 leading-tight">
                Get SMS alerts?
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                Optional. We'll text you the second a permit opens.
              </p>
              <div className="mt-8">
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-() ]/g, ""))}
                    className="w-full pl-11 pr-4 py-4 rounded-xl border border-border bg-card text-foreground text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
                    maxLength={20}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-3 px-1">
                  US numbers only. Standard SMS rates apply. You can add this later in Settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: You're live */}
          {step === 3 && (
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
                every 60 seconds.
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

          {/* Bottom nav */}
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

            {step === TOTAL_STEPS - 1 && (
              <p className="text-[11px] text-muted-foreground/70 text-center mb-1">
                By continuing, you agree to the WildAtlas{" "}
                <a href="/terms" target="_blank" className="underline hover:text-muted-foreground transition-colors">
                  Terms of Service
                </a>.
              </p>
            )}

            <button
              onClick={next}
              disabled={!canProceed || saving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? "Setting up..." : step === TOTAL_STEPS - 1 ? "Go to Dashboard" : step === 2 && !phone ? "Skip for now" : "Continue"}
              {!saving && <ArrowRight size={16} />}
            </button>

            {step === TOTAL_STEPS - 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <a href="/terms" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Terms</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/privacy" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Privacy</a>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const StepBadge = ({ number }: { number: number }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-semibold w-fit uppercase tracking-wider">
    Step {number} of {TOTAL_STEPS}
  </div>
);

export default OnboardingFlow;
