import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import wildatlasLogo from "@/assets/wildatlas-logo.png";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerChild = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.6,
    ease: EASE,
    delay: i * 0.06,
  },
});

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const attemptsRef = useRef<number[]>([]);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const isRateLimited = (): boolean => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter((t) => now - t < WINDOW_MS);
    if (attemptsRef.current.length >= MAX_ATTEMPTS) {
      const waitSec = Math.ceil((WINDOW_MS - (now - attemptsRef.current[0])) / 1000);
      toast({ title: "Slow down!", description: `Too many attempts. Try again in ${waitSec}s.` });
      return true;
    }
    attemptsRef.current.push(now);
    return false;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRateLimited()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        navigate("/check-email", { state: { email } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast({
        title: "Trail hiccup",
        description: e.message?.includes("Invalid")
          ? "Double-check your email and password."
          : "Having trouble reaching the park gates. Give it a moment!",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (isRateLimited()) return;
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Trail hiccup", description: "Google sign-in hit a snag. Try again in a moment!" });
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Hold on!", description: "Enter your email first so we can find your account." });
      return;
    }
    if (isRateLimited()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Trail hiccup", description: "Having trouble sending the reset email. Try again shortly." });
    } else {
      toast({ title: "Check your email", description: "We sent you a password reset link." });
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#F8F6F3",
    border: "1.5px solid #E0DDD9",
    color: "#1A2018",
    borderRadius: 10,
    padding: "14px 16px 14px 44px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
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

  const iconStyle: React.CSSProperties = {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#A8C4B8",
  };

  return (
    <>
      <style>{`.auth-input::placeholder { color: #A8A8A0 !important; } @keyframes auth-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      <div
        className="min-h-svh w-full flex flex-col items-center justify-center px-5 py-12 font-body"
        style={{ background: "#F0EDEA" }}
      >
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-[420px] flex flex-col items-stretch"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 20,
            padding: "52px 44px 44px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Logo + Wordmark */}
          <motion.div
            {...staggerChild(0)}
            className="flex flex-col items-center"
            style={{ gap: 8, marginBottom: 40 }}
          >
            <img
              src={wildatlasLogo}
              alt="WildAtlas"
              width={88}
              style={{
                height: "auto",
                background: "transparent",
                border: "none",
                padding: 0,
                borderRadius: 0,
                display: "block",
              }}
            />
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.28em",
                fontWeight: 500,
                color: "#2F6F4E",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              WILDATLAS
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div {...staggerChild(1)} className="text-center" style={{ marginBottom: 8 }}>
            <h1 style={{ margin: 0, lineHeight: 1.12 }}>
              {isSignUp ? (
                <span
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: 36,
                    color: "#1A2018",
                  }}
                >
                  Create your account
                </span>
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: 36,
                      color: "#1A2018",
                    }}
                  >
                    Never miss a{" "}
                  </span>
                  <br />
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontWeight: 400,
                      fontSize: 38,
                      color: "#2F6F4E",
                    }}
                  >
                    permit again.
                  </span>
                </>
              )}
            </h1>
          </motion.div>

          {/* Subline */}
          <motion.p
            {...staggerChild(2)}
            style={{
              fontSize: "13px",
              color: "#6B7B6A",
              letterSpacing: "0.02em",
              textAlign: "center",
              marginBottom: 36,
              marginTop: 0,
            }}
          >
            {isSignUp
              ? "Sign up to start getting permit alerts."
              : "Real-time alerts. No refreshing. No guessing."}
          </motion.p>

          {/* Google button */}
          <motion.button
            {...staggerChild(3)}
            onClick={handleGoogle}
            className="auth-google-btn"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "13px 20px",
              background: "#FFFFFF",
              border: "1.5px solid #E0DDD9",
              borderRadius: 10,
              color: "#1A2018",
              fontSize: "14px",
              cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s",
              marginBottom: 20,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F8F6F3";
              e.currentTarget.style.borderColor = "#C8C4BE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.borderColor = "#E0DDD9";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </motion.button>

          {/* OR divider */}
          <motion.div
            {...staggerChild(4)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              marginBottom: 20,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#E0DDD9" }} />
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "0.1em",
                color: "#9A9A90",
                textTransform: "uppercase",
              }}
            >
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "#E0DDD9" }} />
          </motion.div>

          {/* Form */}
          <motion.form
            {...staggerChild(5)}
            onSubmit={handleEmailAuth}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}
          >
            {isSignUp && (
              <div style={{ position: "relative" }}>
                <User size={15} style={iconStyle} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="auth-input"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
            )}
            <div style={{ position: "relative" }}>
              <Mail size={15} style={iconStyle} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="auth-input"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={iconStyle} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="auth-input"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                marginTop: 6,
                marginBottom: 24,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 10,
                padding: "15px 20px",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "#2F6F4E",
                color: "#FFFFFF",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(47,111,78,0.25)",
                transition: "background 0.2s, transform 0.2s",
                transform: "translateY(0)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#265E41";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#2F6F4E";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            >
              {loading ? (
                "…"
              ) : (
                <>
                  {isSignUp ? "GET PERMIT ALERTS" : "START TRACKING"}
                  <ArrowRight size={15} strokeWidth={2.5} />
                </>
              )}
            </button>
          </motion.form>

          {/* Footer links */}
          <motion.div
            {...staggerChild(6)}
            className="w-full flex flex-col items-center"
            style={{ gap: 10 }}
          >
            {!isSignUp && (
              <button
                onClick={handleForgotPassword}
                style={{
                  fontSize: "13px",
                  color: "#9A9A90",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#6B7B6A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#9A9A90"; }}
              >
                Forgot password?
              </button>
            )}
            <p
              style={{
                fontSize: "13px",
                color: "#9A9A90",
                textAlign: "center",
                margin: 0,
              }}
            >
              {isSignUp ? "Have an account? " : "New to WildAtlas? "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  fontWeight: 600,
                  color: "#2F6F4E",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#265E41"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#2F6F4E"; }}
              >
                {isSignUp ? "Sign in" : "Create account"}
              </button>
            </p>
          </motion.div>

          {/* Bottom badge */}
          <motion.div
            {...staggerChild(7)}
            className="w-full flex items-center justify-center"
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: "1px solid rgba(245,241,236,0.05)",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#2F6F4E",
                boxShadow: "0 0 6px rgba(47,111,78,0.7)",
                flexShrink: 0,
                animation: "auth-dot-pulse 2.5s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: "10.5px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "rgba(245,241,236,0.20)",
              }}
            >
              MONITORING 8 NATIONAL PARKS
            </span>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default AuthPage;
