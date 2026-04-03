import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import mochiWave from "@/assets/mochi-wave-transparent.png";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerChild = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay: i * 0.06 },
});

const inputStyle: React.CSSProperties = {
  background: "#F8F6F3",
  border: "1.5px solid #E0DDD9",
  color: "#1A2018",
  borderRadius: 10,
  padding: "14px 16px 14px 44px",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
};

const iconStyle: React.CSSProperties = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#A8C4B8",
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#2F6F4E";
  e.currentTarget.style.background = "#FFFFFF";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(47,111,78,0.08)";
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#E0DDD9";
  e.currentTarget.style.background = "#F8F6F3";
  e.currentTarget.style.boxShadow = "none";
};

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
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
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
    <>
      <style>{`.reset-input::placeholder { color: #A8A8A0 !important; } @keyframes reset-fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div
        className="min-h-svh w-full flex flex-col items-center justify-center px-5 py-12 font-body"
        style={{ background: "#F0EDEA" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-[420px] flex flex-col items-stretch"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 20,
            padding: "48px 36px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)",
          }}
        >
          {/* Logo + Wordmark */}
          <motion.div
            {...staggerChild(0)}
            className="flex flex-col items-center"
            style={{ gap: 8, marginBottom: 24 }}
          >
            <img
              src={mochiWave}
              alt="Poko"
              width={64}
              style={{ display: "block" }}
              loading="lazy"
            />
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22,
                fontWeight: 400,
                color: "#1a1a1a",
                textAlign: "center",
              }}
            >
              WildAtlas
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div {...staggerChild(1)} className="text-center" style={{ marginBottom: 8 }}>
            <h1 style={{ margin: 0, lineHeight: 1.12 }}>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: 40,
                  color: "#1A2018",
                }}
              >
                Reset{" "}
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 40,
                  color: "#3D6B52",
                }}
              >
                password.
              </span>
            </h1>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: "#6B6B6B",
              marginTop: 4,
              marginBottom: 0,
            }}>
              Happens to everyone. Even Poko forgets sometimes.
            </p>
          </motion.div>

          {/* Status line */}
          <motion.p
            {...staggerChild(2)}
            style={{
              fontSize: 14,
              color: "#666",
              textAlign: "center",
              marginBottom: 24,
              marginTop: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isRecovery ? "Enter your new password below." : "Waiting for recovery link verification\u2026"}
          </motion.p>

          {isRecovery ? (
            <motion.form
              {...staggerChild(3)}
              onSubmit={handleReset}
              style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}
            >
              <div style={{ position: "relative" }}>
                <Lock size={15} style={iconStyle} aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  aria-label="New password"
                  required
                  minLength={6}
                  className="reset-input"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={iconStyle} aria-hidden="true" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  aria-label="Confirm new password"
                  required
                  minLength={6}
                  className="reset-input"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#2F6F4E",
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  marginTop: 4,
                  transition: "opacity 200ms",
                }}
              >
                Update Password
                <ArrowRight size={16} />
              </button>
            </motion.form>
          ) : (
            <motion.div {...staggerChild(3)}>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: "#888",
                textAlign: "center",
                maxWidth: 280,
                margin: "0 auto",
                lineHeight: 1.55,
              }}>
                If you arrived here without a recovery link, please go back and request a password reset.
              </p>

              {showTimeout && (
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "#888",
                  textAlign: "center",
                  marginTop: 16,
                  lineHeight: 1.5,
                  animation: "reset-fade-in 500ms ease-out",
                }}>
                  Taking longer than expected. Check that you clicked the most recent reset link, or request a new one below.
                </p>
              )}
            </motion.div>
          )}

          {/* Links */}
          <motion.div
            {...staggerChild(4)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              marginTop: 24,
            }}
          >
            <button
              onClick={() => navigate("/")}
              aria-label="Go back to WildAtlas"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: "#6B7B6A",
                display: "flex",
                alignItems: "center",
                gap: 6,
                minHeight: 44,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#2F6F4E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7B6A"; }}
            >
              <ArrowLeft size={14} />
              Back to WildAtlas
            </button>

            {!isRecovery && (
              <>
                {resendResult === "success" ? (
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#2F6F4E",
                    margin: 0,
                    textAlign: "center",
                  }}>
                    Reset link sent — check your inbox and spam folder.
                  </p>
                ) : showResend ? (
                  <div style={{ width: "100%" }}>
                    <div style={{ position: "relative", marginBottom: 10 }}>
                      <Mail size={15} style={iconStyle} aria-hidden="true" />
                      <input
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="Email address"
                        aria-label="Email address for password reset"
                        className="reset-input"
                        style={inputStyle}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                    </div>
                    <button
                      onClick={handleResend}
                      disabled={resendLoading || !resendEmail.trim()}
                      style={{
                        width: "100%",
                        padding: "14px 20px",
                        borderRadius: 10,
                        border: "none",
                        backgroundColor: "#2F6F4E",
                        color: "#FFFFFF",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        cursor: resendLoading || !resendEmail.trim() ? "not-allowed" : "pointer",
                        opacity: resendLoading || !resendEmail.trim() ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 48,
                        transition: "opacity 200ms",
                      }}
                    >
                      {resendLoading ? "Sending\u2026" : "Send reset link"}
                      {!resendLoading && <ArrowRight size={14} />}
                    </button>
                    {resendResult === "error" && (
                      <p style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: "#888",
                        textAlign: "center",
                        marginTop: 10,
                        lineHeight: 1.5,
                      }}>
                        Something went wrong — try again or contact wildatlasnp@gmail.com
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResend(true)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#2F6F4E",
                      minHeight: 44,
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                  >
                    Didn't receive a link? Resend reset email
                  </button>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default ResetPassword;
