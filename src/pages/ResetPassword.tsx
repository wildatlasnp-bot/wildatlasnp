import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Lock } from "lucide-react";
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        background: "linear-gradient(to bottom, #C4A99A 0%, #D4B896 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        {/* Mochi asset */}
        <img
          src="/mochi-standing.png"
          alt="Mochi"
          style={{ width: 80, height: 80, objectFit: "contain", margin: "0 auto", display: "block" }}
        />
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
          letterSpacing: "0.15em", textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.7)", marginTop: 8, marginBottom: 32,
        }}>
          WILDATLAS
        </p>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400,
          color: "#1a1a1a", margin: 0, lineHeight: 1.1,
        }}>
          Reset Password
        </h1>

        {/* Status line */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 400,
          color: "#555", marginTop: 8, marginBottom: 0,
        }}>
          {isRecovery ? "Enter your new password below." : "Waiting for recovery link verification\u2026"}
        </p>

        {isRecovery ? (
          <form onSubmit={handleReset} style={{ marginTop: 24 }}>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                aria-label="New password"
                required
                minLength={6}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#FFFFFF", border: "1px solid #ddd", borderRadius: 12,
                  padding: "14px 16px 14px 40px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                required
                minLength={6}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#FFFFFF", border: "1px solid #ddd", borderRadius: 12,
                  padding: "14px 16px 14px 40px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 15, borderRadius: 12, border: "none",
                backgroundColor: "#2F6F4E", color: "#fff",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 48, transition: "opacity 200ms",
              }}
            >
              Update Password
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div style={{ marginTop: 24 }}>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400,
              color: "#777", maxWidth: 320, margin: "0 auto", lineHeight: 1.55,
            }}>
              If you arrived here without a recovery link, please go back and request a password reset.
            </p>

            {showTimeout && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400,
                color: "#888", marginTop: 16, lineHeight: 1.5,
                animation: "fadeIn 500ms ease-out",
              }}>
                Taking longer than expected. Check that you clicked the most recent reset link, or request a new one below.
              </p>
            )}
          </div>
        )}

        {/* Links */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/")}
            aria-label="Go back"
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
              color: "#2F6F4E",
              display: "flex", alignItems: "center", gap: 6, minHeight: 44,
            }}
          >
            <ArrowLeft size={14} />
            Back to WildAtlas
          </button>

          {!isRecovery && (
            <>
              {resendResult === "success" ? (
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                  color: "#2F6F4E", margin: 0,
                }}>
                  Reset link sent — check your inbox and spam folder.
                </p>
              ) : showResend ? (
                <div style={{ width: "100%", maxWidth: 320 }}>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Your email address"
                    aria-label="Email address for password reset"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#FFFFFF", border: "1px solid #ddd", borderRadius: 12,
                      padding: "14px 16px",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
                      outline: "none", marginBottom: 10,
                    }}
                  />
                  <button
                    onClick={handleResend}
                    disabled={resendLoading || !resendEmail.trim()}
                    style={{
                      width: "100%", padding: 15, borderRadius: 12, border: "none",
                      backgroundColor: "#2F6F4E", color: "#fff",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                      cursor: resendLoading || !resendEmail.trim() ? "not-allowed" : "pointer",
                      opacity: resendLoading || !resendEmail.trim() ? 0.5 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      minHeight: 48, transition: "opacity 200ms",
                    }}
                  >
                    {resendLoading ? "Sending\u2026" : "Send reset link"}
                    {!resendLoading && <ArrowRight size={14} />}
                  </button>
                  {resendResult === "error" && (
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400,
                      color: "#888", marginTop: 10, lineHeight: 1.5,
                    }}>
                      Something went wrong — try again or contact wildatlasnp@gmail.com
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowResend(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                    color: "#2F6F4E", minHeight: 44,
                  }}
                >
                  Didn't receive a link? Resend reset email
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
