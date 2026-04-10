import { useState, useEffect, useCallback } from "react";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const COOLDOWN_SECONDS = 60;

const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
};

const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const email = (location.state as any)?.email as string | undefined;
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [justSent, setJustSent] = useState(false);

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
      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
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
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
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
          We sent a confirmation link{email ? <> to <span className="font-medium text-foreground">{maskEmail(email)}</span></> : null}.
          {" "}Click it to activate your account and start getting permit alerts.
        </p>

        <div className="mt-7 space-y-3">
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

          {/* Resend button */}
          {email && (
            <div className="space-y-1.5">
              <button
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-[10px] py-3 border transition-colors disabled:cursor-not-allowed"
                style={{
                  borderColor: cooldown > 0 ? "hsl(var(--border))" : "#2F6F4E",
                  color: cooldown > 0 ? "hsl(var(--muted-foreground))" : "#2F6F4E",
                  background: "transparent",
                  opacity: cooldown > 0 ? 0.55 : 1,
                }}
              >
                <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
                {cooldown > 0
                  ? `Resend in ${formatCooldown(cooldown)}...`
                  : "Resend email"}
              </button>
              {justSent && (
                <p className="text-xs font-medium text-center" style={{ color: "#2F6F4E" }}>
                  Email resent ✓
                </p>
              )}
            </div>
          )}

          {/* Back link — tight to content, not floating */}
          <button
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors pt-3 pb-1"
          >
            <ArrowLeft size={13} />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckEmailPage;
