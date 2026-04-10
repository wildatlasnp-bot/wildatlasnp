import { useState, useEffect, useCallback } from "react";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const COOLDOWN_SECONDS = 60;

const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const email = (location.state as any)?.email as string | undefined;
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      setCooldown(COOLDOWN_SECONDS);
      toast({ title: "📬 Email sent!", description: "Check your inbox for a fresh confirmation link." });
    } catch {
      toast({ title: "Trail hiccup", description: "Couldn't resend the email. Try again in a moment." });
    } finally {
      setResending(false);
    }
  }, [email, resending, cooldown, toast]);

  const formatCooldown = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-svh bg-background flex flex-col px-5">
      {/* Content sits in the upper-middle band of the screen */}
      <div className="flex-1 flex flex-col justify-start" style={{ paddingTop: "28vh" }}>
        <div className="w-full max-w-sm mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: "hsl(var(--muted))" }}
          >
            <Mail size={28} className="text-primary" />
          </motion.div>

          <h1 className="text-2xl font-heading font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
            We sent a confirmation link. Click it to activate your account and start getting permit alerts.
          </p>

          {email && (
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Sent to <span className="font-medium text-muted-foreground">{email}</span>
            </p>
          )}

          <div className="mt-7 space-y-3">
            {/* Resend button */}
            {email && (
              <button
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium rounded-[10px] py-3 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--secondary))",
                  background: "transparent",
                }}
              >
                <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
                {cooldown > 0
                  ? `Resend in ${formatCooldown(cooldown)}`
                  : "Resend email"}
              </button>
            )}

            {/* Help card */}
            <div
              className="rounded-xl p-4 text-left"
              style={{
                backgroundColor: "hsl(var(--muted))",
                border: "0.5px solid hsl(var(--border))",
              }}
            >
              <p className="text-xs font-semibold text-foreground mb-2">Don't see it?</p>
              <ul className="text-xs text-muted-foreground flex flex-col gap-1.5 list-disc list-inside">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the right email</li>
                <li>Allow a few minutes for delivery</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Back link pinned to bottom */}
      <div className="w-full max-w-sm mx-auto pb-8 pt-4">
        <button
          onClick={() => navigate("/auth")}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-3"
        >
          <ArrowLeft size={13} />
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default CheckEmailPage;
