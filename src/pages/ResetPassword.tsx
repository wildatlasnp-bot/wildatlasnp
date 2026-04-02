import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  // Timeout hint after 10s if still waiting
  useEffect(() => {
    if (isRecovery) return;
    const timer = setTimeout(() => setShowTimeout(true), 10000);
    return () => clearTimeout(timer);
  }, [isRecovery]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResendLoading(false);
    setResendResult(error ? "error" : "success");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Hold on!", description: "Those passwords don't match. Try again!" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Too short!", description: "Your password needs at least 6 characters to keep your account safe." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Trail hiccup", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } else {
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRecovery ? "Enter your new password below." : "Waiting for recovery link verification\u2026"}
          </p>
        </div>

        {isRecovery ? (
          <form onSubmit={handleReset} className="space-y-3">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                aria-label="New password"
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Update Password
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              If you arrived here without a recovery link, please go back and request a password reset.
            </p>

            {/* Timeout hint */}
            {showTimeout && (
              <p
                className="text-[13px] text-muted-foreground/70 animate-in fade-in duration-500"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Taking longer than expected. Check that you clicked the most recent reset link, or request a new one below.
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="mt-6 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
          style={{ minHeight: 44 }}
        >
          <ArrowLeft size={14} />
          Back to WildAtlas
        </button>

        {/* Resend reset link */}
        {!isRecovery && (
          <div className="mt-4 text-center">
            {resendResult === "success" ? (
              <p className="text-[14px]" style={{ fontFamily: "'DM Sans', sans-serif", color: "#2F6F4E" }}>
                Reset link sent — check your inbox and spam folder.
              </p>
            ) : showResend ? (
              <div className="space-y-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Your email address"
                  aria-label="Email address for password reset"
                  className="w-full bg-card border border-border rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: "#2F6F4E", fontFamily: "'DM Sans', sans-serif", minHeight: 44 }}
                >
                  {resendLoading ? "Sending\u2026" : "Send reset link"}
                  {!resendLoading && <ArrowRight size={14} />}
                </button>
                {resendResult === "error" && (
                  <p className="text-[13px] text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Something went wrong — try again or contact wildatlasnp@gmail.com
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowResend(true)}
                className="text-[14px] hover:underline transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif", color: "#2F6F4E", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}
              >
                Didn't receive a link? Resend reset email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
