import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mountain, Bell, MapPin } from "lucide-react";
import heroImg from "@/assets/yosemite-hero.jpg";

interface Props {
  onComplete: () => void;
}

const screens = [
  {
    image: heroImg,
    icon: MapPin,
    heading: "Your 2026 Yosemite Ally.",
    sub: "Tactical logistics for the modern ranger.",
  },
  {
    image: null,
    icon: Mountain,
    heading: "Navigate the New Rules.",
    sub: "Real-time parking alerts and fee tracking to beat the 8:30 AM rush.",
  },
  {
    image: null,
    icon: Bell,
    heading: "Never Miss a Permit.",
    sub: "Mochi 🐻 will alert you instantly when Half Dome or Wilderness spots open up.",
  },
];

const OnboardingFlow = ({ onComplete }: Props) => {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < screens.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("wildatlas_onboarded", "true");
      onComplete();
    }
  };

  const skip = () => {
    localStorage.setItem("wildatlas_onboarded", "true");
    onComplete();
  };

  const current = screens[step];
  const isLast = step === screens.length - 1;

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
          {/* Hero area */}
          <div className="relative h-[52vh] flex items-center justify-center overflow-hidden">
            {current.image ? (
              <>
                <img
                  src={current.image}
                  alt="Yosemite"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-secondary/5 to-background" />
            )}

            {!current.image && (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.15, damping: 14 }}
                className="relative z-10 w-24 h-24 rounded-full bg-secondary/15 flex items-center justify-center"
              >
                <current.icon size={44} className="text-secondary" />
              </motion.div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 px-7 pt-6 pb-8 flex flex-col">
            <h1 className="font-heading text-[26px] font-bold text-primary leading-tight">
              {current.heading}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-3 leading-relaxed">
              {current.sub}
            </p>

            <div className="mt-auto space-y-3 pt-8">
              {/* Dots */}
              <div className="flex items-center justify-center gap-2 mb-5">
                {screens.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? "w-6 bg-secondary"
                        : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              {/* Consent text on last screen */}
              {isLast && (
                <p className="text-[11px] text-muted-foreground/70 text-center mb-1">
                  By continuing, you agree to the WildAtlas{" "}
                  <a href="/terms" target="_blank" className="underline hover:text-muted-foreground transition-colors">
                    Terms of Service
                  </a>.
                </p>
              )}

              {/* Primary button */}
              <button
                onClick={next}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[15px] py-4 rounded-xl hover:opacity-90 transition-opacity"
              >
                {isLast ? "Let's Go" : "Continue"}
                <ArrowRight size={16} />
              </button>

              {/* Skip */}
              {!isLast && (
                <button
                  onClick={skip}
                  className="w-full text-[13px] font-medium text-muted-foreground py-2 hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              )}

              {/* Legal links on last screen */}
              {isLast && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <a href="/terms" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    Terms of Service
                  </a>
                  <span className="text-muted-foreground/30">·</span>
                  <a href="/privacy" target="_blank" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    Privacy Policy
                  </a>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
