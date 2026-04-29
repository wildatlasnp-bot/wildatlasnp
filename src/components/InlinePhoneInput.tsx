import { useState } from "react";
import { Phone, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toE164 } from "@/lib/phone";

interface InlinePhoneInputProps {
  userId: string;
  watchId: string;
  onPhoneSaved: (watchId: string) => void;
}

type Step = "input" | "otp";

const InlinePhoneInput = ({ userId, watchId, onPhoneSaved }: InlinePhoneInputProps) => {
  const [phoneInput, setPhoneInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [savedPhone, setSavedPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const e164Phone = toE164(phoneInput);
    if (!e164Phone) {
      toast({ title: "Invalid phone number", description: "Please enter a valid 10-digit US number.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Save phone + consent to profile — do NOT enable notify_sms yet
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          phone_number: e164Phone,
          sms_consent_at: new Date().toISOString(),
          sms_consent_version: "v1-2026-04",
        } as any)
        .eq("user_id", userId);

      if (profileErr) {
        if (profileErr.code === "23505") {
          toast({ title: "Phone already in use", description: "This number is associated with another account.", variant: "destructive" });
        } else {
          toast({ title: "Error saving phone", description: profileErr.message, variant: "destructive" });
        }
        return;
      }

      // Send verification code
      const { data: { session } } = await supabase.auth.getSession();
      const { error: sendErr } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: e164Phone },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (sendErr) {
        toast({ title: "Couldn't send code", description: "Please try again.", variant: "destructive" });
        return;
      }

      setSavedPhone(e164Phone);
      setStep("otp");
      toast({ title: "Code sent", description: `Verification code sent to ···${e164Phone.slice(-4)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone: savedPhone, code: otpCode },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      // Handle 401 = incorrect code (not a network failure)
      if (error) {
        let errBody: any = null;
        try { errBody = error.context ? await error.context.json() : null; } catch {}
        if (errBody?.verified === false) {
          toast({ title: "Incorrect code", description: errBody?.error || "Please try again.", variant: "destructive" });
          return;
        }
        toast({ title: "Verification failed", description: "Please try again.", variant: "destructive" });
        return;
      }

      const body = typeof data === "string" ? JSON.parse(data) : data;

      if (body?.verified) {
        // Now enable SMS on this watch
        await supabase
          .from("user_watchers")
          .update({ notify_sms: true })
          .eq("id", watchId);
        onPhoneSaved(watchId);
        toast({ title: "SMS alerts activated", description: "You'll get a text when this permit opens." });
      } else {
        toast({ title: "Incorrect code", description: body?.error || "Please try again.", variant: "destructive" });
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: savedPhone },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        toast({ title: "Couldn't resend", description: "Please wait and try again.", variant: "destructive" });
      } else {
        toast({ title: "Code resent", description: `New code sent to ···${savedPhone.slice(-4)}` });
        setOtpCode("");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {step === "input" ? (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="pt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d+\-() ]/g, ""))}
                  aria-label="Phone number"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
                  maxLength={20}
                />
              </div>
              <button
                disabled={phoneInput.replace(/\D/g, "").length < 10 || saving}
                onClick={handleSave}
                className="shrink-0 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? "…" : "Save"}
              </button>
            </div>
            <p className="text-[12px] text-muted-foreground/60 mt-1.5">
              By saving, you consent to receive automated permit alert texts from WildAtlas. Msg &amp; data rates may apply. Reply STOP to cancel.
            </p>
          </motion.div>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="pt-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
              <p className="text-[12px] text-foreground">
                Enter the 6-digit code sent to ···{savedPhone.slice(-4)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-label="Verification code"
                className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-[13px] text-center tracking-[0.3em] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
                maxLength={6}
                autoFocus
              />
              <button
                disabled={otpCode.length !== 6 || verifying}
                onClick={handleVerify}
                className="shrink-0 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {verifying ? "…" : "Verify"}
              </button>
            </div>
            <button
              onClick={handleResend}
              disabled={resending}
              className="mt-1.5 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-40"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InlinePhoneInput;
