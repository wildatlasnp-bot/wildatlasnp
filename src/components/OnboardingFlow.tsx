import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mountain, Bell, MapPin, CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/yosemite-hero.jpg";

interface Props {
  onComplete: () => void;
  userId: string;
}

const PERMIT_OPTIONS = [
  { name: "Half Dome", icon: Mountain, desc: "Day hike cables permit" },
  { name: "Yosemite Wilderness", icon: MapPin, desc: "Backcountry overnight permits" },
];

const OnboardingFlow = ({ onComplete, userId }: Props) => {
  const [step, setStep] = useState(0);
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [selectedPermits, setSelectedPermits] = useState<string[]>(["Half Dome"]);

  const totalSteps = 4; // intro, navigate rules, date, permits

  const togglePermit = (name: string) => {
    setSelectedPermits((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const seedWatches = async () => {
    for (const permitName of selectedPermits) {
      const { data } = await supabase
        .from("active_watches")
        .select("id")
        .eq("user_id", userId)
        .eq("permit_name", permitName)
        .maybeSingle();
      if (!data) {
        await supabase.from("active_watches").insert({
          user_id: userId,
          permit_name: permitName,
          is_active: true,
          status: "searching",
        });
      }
    }
  };

  const finish = () => {
    localStorage.setItem("wildatlas_onboarded", "true");
    if (arrivalDate) {
      localStorage.setItem("wildatlas_arrival_date", arrivalDate.toISOString());
    }
    seedWatches();
    onComplete();
  };

  const next = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const skip = () => finish();

  const isLast = step === totalSteps - 1;
  const canProceed = step === 2 ? !!arrivalDate : step === 3 ? selectedPermits.length > 0 : true;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-1 flex flex-col"
        >
          {/* Step 0: Hero intro */}
          {step === 0 && (
            <>
              <div className="relative h-[52vh] flex items-center justify-center overflow-hidden">
                <img src={heroImg} alt="Yosemite" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
              </div>
              <div className="flex-1 px-7 pt-6 pb-8 flex flex-col">
                <h1 className="font-heading text-[26px] font-bold text-primary leading-tight">Your 2026 Yosemite Ally.</h1>
                <p className="text-[15px] text-muted-foreground mt-3 leading-relaxed">Tactical logistics for the modern ranger.</p>
              </div>
            </>
          )}

          {/* Step 1: Navigate rules */}
          {step === 1 && (
            <>
              <div className="relative h-[52vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-secondary/5 to-background" />
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.15, damping: 14 }}
                  className="relative z-10 w-24 h-24 rounded-full bg-secondary/15 flex items-center justify-center"
                >
                  <Bell size={44} className="text-secondary" />
                </motion.div>
              </div>
              <div className="flex-1 px-7 pt-6 pb-8 flex flex-col">
                <h1 className="font-heading text-[26px] font-bold text-primary leading-tight">Never Miss a Permit.</h1>
                <p className="text-[15px] text-muted-foreground mt-3 leading-relaxed">
                  Mochi 🐻 will alert you instantly when Half Dome or Wilderness spots open up.
                </p>
              </div>
            </>
          )}

          {/* Step 2: When are you going? */}
          {step === 2 && (
            <div className="flex-1 px-7 pt-16 pb-8 flex flex-col">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 14 }}
                className="w-16 h-16 rounded-full bg-secondary/15 flex items-center justify-center mx-auto mb-6"
              >
                <CalendarIcon size={32} className="text-secondary" />
              </motion.div>
              <h1 className="font-heading text-[26px] font-bold text-primary leading-tight text-center">When are you going?</h1>
              <p className="text-[14px] text-muted-foreground mt-2 text-center leading-relaxed">
                We'll focus alerts around your trip dates.
              </p>
              <div className="flex justify-center mt-8">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "w-full max-w-xs flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-medium transition-colors",
                        arrivalDate
                          ? "bg-secondary/10 border-secondary/30 text-foreground"
                          : "bg-card border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <CalendarIcon size={16} />
                      {arrivalDate ? format(arrivalDate, "MMMM d, yyyy") : "Pick your arrival date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={arrivalDate}
                      onSelect={setArrivalDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Step 3: Which permits? */}
          {step === 3 && (
            <div className="flex-1 px-7 pt-16 pb-8 flex flex-col">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 14 }}
                className="w-16 h-16 rounded-full bg-secondary/15 flex items-center justify-center mx-auto mb-6"
              >
                <Mountain size={32} className="text-secondary" />
              </motion.div>
              <h1 className="font-heading text-[26px] font-bold text-primary leading-tight text-center">What permits do you need?</h1>
              <p className="text-[14px] text-muted-foreground mt-2 text-center leading-relaxed">
                We'll start monitoring these for you right away.
              </p>
              <div className="mt-8 space-y-3">
                {PERMIT_OPTIONS.map((permit) => {
                  const Icon = permit.icon;
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
                      <div className="flex-1">
                        <p className="font-semibold text-[13px] text-foreground">{permit.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{permit.desc}</p>
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"
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

          {/* Bottom nav area - shared across all steps */}
          <div className="px-7 pb-8 space-y-3 mt-auto">
            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-secondary" : "w-1.5 bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>

            {isLast && (
              <p className="text-[11px] text-muted-foreground/70 text-center mb-1">
                By continuing, you agree to the WildAtlas{" "}
                <a href="/terms" target="_blank" className="underline hover:text-muted-foreground transition-colors">
                  Terms of Service
                </a>.
              </p>
            )}

            <button
              onClick={next}
              disabled={!canProceed}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isLast ? "Start Monitoring" : "Continue"}
              <ArrowRight size={16} />
            </button>

            {!isLast && (
              <button
                onClick={skip}
                className="w-full text-[13px] font-medium text-muted-foreground py-2 hover:text-foreground transition-colors"
              >
                Skip
              </button>
            )}

            {isLast && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <a href="/terms" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Terms of Service</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/privacy" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Privacy Policy</a>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
