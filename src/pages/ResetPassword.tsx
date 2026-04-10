import { useState, useEffect, useCallback } from "react";
import { KeyRound, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [showResendInput, setShowResendInput] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(() => setSent(false), 3000);
    return () => window.clearTimeout(id);
  }, [sent]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Hold on!", description: "Those passwords don't match. Try again!" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Too short!", description: "Your password needs at least 6 characters." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Trail hiccup", description: "Something went wrong. Try again in a moment." });
    } else {
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/");
    }
  };

  const handleResend = useCallback(async () => {
    if (busy || sent) return;
    if (!resendEmail.trim()) {
      setShowResendInput(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Trail hiccup", description: "Couldn't send. Try again in a moment." });
    } else {
      setSent(true);
    }
  }, [busy, sent, resendEmail, toast]);

  const inputStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid rgba(47,111,78,0.25)",
    color: "#1A2F1E",
    borderRadius: 10,
    padding: "14px 16px 14px 44px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const iconStyle: React.CSSProperties = {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#A8C4B8",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#2F6F4E";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(47,111,78,0.08)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(47,111,78,0.25)";
    e.currentTarget.style.boxShadow = "none";
  };

  // ─── Recovery form state: show password inputs ───
  if (isRecovery) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: "#F0EDEA",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ height: "10vh", flexShrink: 0 }} />

        <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", textAlign: "center", padding: "0 20px" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              backgroundColor: "#1A2F1E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <Lock size={30} color="#FFFFFF" strokeWidth={1.5} />
          </div>

          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(38px, 10.4vw, 42px)",
              fontWeight: 400,
              color: "#1A2F1E",
              marginTop: 28,
              marginBottom: 0,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            New password
          </h1>

          <div style={{ width: 48, height: 1, backgroundColor: "rgba(26,47,30,0.2)", margin: "16px auto" }} />

          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              color: "#5a5a4a",
              lineHeight: 1.6,
              margin: "0 0 28px",
            }}
          >
            Enter your new password below.
          </p>

          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={iconStyle} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={6}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={iconStyle} />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
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
                minHeight: 48,
                marginTop: 4,
                transition: "opacity 200ms",
              }}
            >
              Update Password
            </button>
          </form>
        </div>

        <div style={{ flexShrink: 0, paddingBottom: 40, textAlign: "center" }}>
          <span
            onClick={() => navigate("/")}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888878", cursor: "pointer" }}
          >
            ← Back to sign in
          </span>
        </div>
      </div>
    );
  }

  // ─── Waiting state: no recovery token yet ───
  return (
    <div
      style={{
        minHeight: "100svh",
        background: "#F0EDEA",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ height: "10vh", flexShrink: 0 }} />

      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", textAlign: "center", padding: "0 20px" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "#1A2F1E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <KeyRound size={30} color="#FFFFFF" strokeWidth={1.5} />
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(36px, 10vw, 42px)",
            fontWeight: 400,
            color: "#1A2F1E",
            marginTop: 28,
            marginBottom: 0,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          Reset your password
        </h1>

        <div style={{ width: 48, height: 1, backgroundColor: "rgba(26,47,30,0.2)", margin: "16px auto" }} />

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            color: "#5a5a4a",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Check your inbox for a reset link. It expires in 1 hour.
        </p>

        <div
          style={{
            marginTop: 32,
            border: "1px solid rgba(47,111,78,0.2)",
            borderRadius: 12,
            padding: "16px 20px",
            textAlign: "left",
            background: "transparent",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#1A2F1E",
              margin: 0,
              marginBottom: 10,
            }}
          >
            Don't see it?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Check your spam or junk folder", "Make sure you entered the right email", "Allow a few minutes for delivery"].map((t) => (
              <p
                key={t}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "#5a5a4a",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ marginRight: 6 }}>•</span>
                {t}
              </p>
            ))}
          </div>
        </div>

        {/* Resend */}
        <div style={{ marginTop: 16, textAlign: "center", minHeight: 20 }}>
          {sent ? (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#2F6F4E" }}>
              Sent ✓
            </span>
          ) : showResendInput ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Your email address"
                style={{
                  ...inputStyle,
                  paddingLeft: 16,
                  fontSize: 13,
                  padding: "10px 14px",
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button
                onClick={handleResend}
                disabled={busy || !resendEmail.trim()}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: busy || !resendEmail.trim() ? "default" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: !resendEmail.trim() ? "#888878" : "#2F6F4E",
                  textDecoration: "underline",
                  textDecorationThickness: "1px",
                  textUnderlineOffset: "2px",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </div>
          ) : (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888878" }}>
              Didn't get it?{" "}
              <button
                onClick={() => setShowResendInput(true)}
                style={{
                  color: "#2F6F4E",
                  textDecoration: "underline",
                  textDecorationThickness: "1px",
                  textUnderlineOffset: "2px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                Resend reset email
              </button>
            </span>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, paddingBottom: 40, textAlign: "center" }}>
        <span
          onClick={() => navigate("/")}
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888878", cursor: "pointer" }}
        >
          ← Back to sign in
        </span>
      </div>
    </div>
  );
};

export default ResetPassword;
