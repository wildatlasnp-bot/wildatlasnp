import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  phone: string; // E.164 format
  displayPhone: string; // formatted for display
  userId: string;
  onVerified: () => void;
  onSkip: () => void;
  stepBadge?: React.ReactNode;
}

const RESEND_DELAY = 30;

const PhoneVerifyStep = ({ phone, displayPhone, userId, onVerified, onSkip, stepBadge }: Props) => {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_DELAY);
  const [sending, setSending] = useState(false);

  // Send code on mount
  useEffect(() => {
    sendCode();
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const sendCode = async () => {
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: invokeError } = await supabase.functions.invoke("send-verification-code", {
        body: { phone },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (invokeError) {
        console.error("send-verification-code invoke error:", invokeError);
        setError("Failed to send verification code — please try again.");
        return;
      }
      if (data?.error) {
        console.error("send-verification-code response error:", data.error);
        setError(data.error === "Failed to send SMS"
          ? "Failed to send verification code — please try again."
          : data.error);
        return;
      }
      setResendTimer(RESEND_DELAY);
    } catch (e) {
      console.error("send-verification-code exception:", e);
      setError("Failed to send verification code — please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setError("");
    const next = [...digits];
    next[index] = value;
    setDigits(next);

    // Auto-focus next input
    if (value && index < 5) {
      const el = document.getElementById(`otp-${index + 1}`);
      el?.focus();
    }
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`);
      el?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      const el = document.getElementById("otp-5");
      el?.focus();
    }
  }, []);

  const verify = async () => {
    const code = digits.join("");
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone, code },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) {
        setError("Verification failed. Try again.");
        setVerifying(false);
        return;
      }
      if (data?.verified) {
        setVerified(true);
        setTimeout(() => onVerified(), 1500);
      } else {
        setError(data?.error || "Incorrect code — please try again.");
        setVerifying(false);
      }
    } catch {
      setError("Verification failed. Try again.");
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
        {stepBadge}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
           className="w-20 h-20 rounded-full bg-[#F0EDEA] flex items-center justify-center mb-6"
        >
          <Check size={36} className="text-primary" />
        </motion.div>
        <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
          Number verified ✓
        </h1>
        <p className="text-[14px] text-muted-foreground mt-2">
          SMS alerts are now active for your watches.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 pt-14 pb-8 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
           className="w-14 h-14 rounded-xl bg-[#F0EDEA] flex items-center justify-center mb-5"
        >
          <Phone size={26} className="text-primary" />
        </motion.div>

        <h1 className="font-heading text-[24px] font-bold text-foreground leading-tight">
          Verify your number
        </h1>
        <p className="text-[14px] text-muted-foreground mt-2 max-w-[300px]">
          We sent a 6-digit code to {displayPhone}. Enter it below to activate SMS alerts.
        </p>

        {/* OTP Input */}
        <div className="flex items-center gap-2.5 mt-8" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                "w-11 h-13 rounded-xl border-2 bg-card text-center text-[20px] font-bold text-foreground focus:outline-none transition-all",
                error
                  ? "border-destructive/50 focus:ring-2 focus:ring-destructive/30 focus:border-destructive"
                  : "border-border focus:ring-2 focus:ring-primary/40 focus:border-primary"
              )}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] text-destructive mt-3"
          >
            {error}
          </motion.p>
        )}

        {/* Verify button */}
        <button
          onClick={verify}
          disabled={digits.join("").length !== 6 || verifying}
          className="mt-6 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-[14px] px-8 py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-40"
        >
          {verifying ? "Verifying..." : "Verify"}
          {!verifying && <ArrowRight size={14} />}
        </button>

        {/* Resend */}
        <div className="mt-4">
          {resendTimer > 0 ? (
            <p className="text-[12px] text-muted-foreground/50">
              Resend code in {resendTimer}s
            </p>
          ) : (
            <button
              onClick={sendCode}
              disabled={sending}
              className="text-[12px] text-muted-foreground hover:text-foreground underline transition-colors"
            >
              {sending ? "Sending..." : "Resend code"}
            </button>
          )}
        </div>
      </div>

      {/* Skip link */}
      <div className="mt-auto pt-6 flex justify-center">
        <button
          onClick={onSkip}
          className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default PhoneVerifyStep;
