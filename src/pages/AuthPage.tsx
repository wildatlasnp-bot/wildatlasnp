import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Mail, Lock, User, Mountain } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

  const isRateLimited = (): boolean => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (attemptsRef.current.length >= RATE_LIMIT_MAX) {
      const waitSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - attemptsRef.current[0])) / 1000);
      toast({ title: "🐻 Slow down!", description: `Too many attempts. Try again in ${waitSec}s.` });
      return true;
    }
    attemptsRef.current.push(now);
    return false;
  };

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "🐻 Hold on!", description: "Enter your email first so I can find your account." });
      return;
    }
    if (isRateLimited()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "🐻 Trail hiccup", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } else {
      toast({ title: "Check your email", description: "We sent you a password reset link." });
    }
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
            emailRedirectTo: window.location.origin,
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
        title: "🐻 Trail hiccup",
        description: e.message?.includes("Invalid")
          ? "Double-check your email and password."
          : "I'm having trouble reaching the park gates. Give me a moment!",
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
      toast({ title: "🐻 Trail hiccup", description: "Google sign-in hit a snag. Try again in a moment!" });
    }
  };

  return (
    <div
      className="auth-root flex flex-col items-center"
      style={{
        background: "linear-gradient(180deg, #1a2b1a 0%, #0f1a0f 55%, #0a120a 100%)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        height: "100dvh",
        boxSizing: "border-box",
        overflow: "hidden",
        paddingTop: 64,
        paddingBottom: 32,
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
        {/* Logo */}
        <div className="auth-logo flex items-center gap-2" style={{ marginBottom: 32 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.14)",
            }}
          >
            <Mountain size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
          </div>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            WildAtlas
          </span>
        </div>

        {/* Mochi — no glow, no ellipse, no ground shadow */}
        <div className="auth-mochi flex justify-center" style={{ marginBottom: 16 }}>
          <motion.img
            src="/mochi-wave-auth.png"
            alt="Mochi waving"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity }}
            style={{ width: 150, height: 150, objectFit: "contain" }}
          />
        </div>

        {/* Headline */}
        <h1
          className="auth-headline text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.2px",
            color: "#FFFFFF",
            marginBottom: 8,
          }}
        >
          {isSignUp ? "Create your account" : "Never miss a national park permit again."}
        </h1>

        {/* Subtext */}
        <p
          className="auth-subtext text-center"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.65)",
            marginBottom: 24,
          }}
        >
          {isSignUp
            ? "Sign up to start getting permit alerts."
            : "Get alerted the moment permits open — no refreshing needed."}
        </p>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="auth-card"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 22,
            boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            boxSizing: "border-box",
          }}
        >
          {/* Google CTA */}
          <motion.button
            onClick={handleGoogle}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full flex items-center justify-center gap-2.5"
            style={{
              height: 52,
              borderRadius: 12,
              background: "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.96)",
              boxShadow: "0 3px 12px rgba(0,0,0,0.22)",
              transition: "background 150ms ease, box-shadow 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.28)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.11)";
              e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.22)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </motion.button>

          {/* Reassurance line */}
          <p className="text-center" style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            No spam. No posting. Cancel anytime.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3" style={{ marginTop: 16, marginBottom: 16 }}>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.30)",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap" as const,
              }}
            >
              or continue with email
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col">
            {isSignUp && (
              <div className="relative" style={{ marginBottom: 12 }}>
                <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 10,
                    paddingLeft: 38,
                    paddingRight: 14,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.75)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    outline: "none",
                    transition: "border 150ms ease, box-shadow 150ms ease",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(120,180,140,0.6)";
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(120,180,140,0.1)";
                  }}
                  onBlur={(e) => {
                     e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            )}
            <div className="relative" style={{ marginBottom: 12 }}>
              <Mail size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 10,
                  paddingLeft: 38,
                  paddingRight: 14,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.75)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  outline: "none",
                  transition: "border 150ms ease, box-shadow 150ms ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(120,180,140,0.6)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(120,180,140,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <div className="relative" style={{ marginBottom: 16 }}>
              <Lock size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 10,
                  paddingLeft: 38,
                  paddingRight: 14,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.75)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  outline: "none",
                  transition: "border 150ms ease, box-shadow 150ms ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(120,180,140,0.6)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(120,180,140,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: "#FFFFFF",
                background: "rgba(30,58,30,0.85)",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "rgba(23,46,23,0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(30,58,30,0.85)";
              }}
            >
              {isSignUp ? "Get Permit Alerts →" : "Sign in →"}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <div className="flex flex-col items-center" style={{ marginTop: 24, gap: 10 }}>
          {!isSignUp && (
            <button
              onClick={handleForgotPassword}
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Forgot password?
            </button>
          )}
          <p className="text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {isSignUp ? "Have an account? " : "New to WildAtlas? "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                fontWeight: 500,
                color: "#6abf6a",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {isSignUp ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>

        {/* Trust line */}
        <p className="auth-trust-line text-center" style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Used for Yosemite • Zion • Glacier
        </p>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.32) !important; }

        @media (max-width: 480px) {
          .auth-root {
            padding-top: 36px !important;
            padding-bottom: 16px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .auth-logo { margin-bottom: 16px !important; }
          .auth-mochi { margin-bottom: 10px !important; }
          .auth-mochi img { width: 110px !important; height: 110px !important; }
          .auth-headline {
            font-size: 24px !important;
            margin-bottom: 6px !important;
          }
          .auth-subtext {
            font-size: 13px !important;
            margin-bottom: 16px !important;
          }
          .auth-card {
            padding: 16px !important;
            border-radius: 14px !important;
          }
          .auth-google-btn { height: 48px !important; }
          .auth-reassurance { margin-top: 6px !important; font-size: 11px !important; }
          .auth-divider { margin-top: 12px !important; margin-bottom: 12px !important; }
          .auth-input { height: 44px !important; }
          .auth-input-wrap { margin-bottom: 10px !important; }
          .auth-input-wrap-last { margin-bottom: 12px !important; }
          .auth-submit { height: 44px !important; }
          .auth-footer { margin-top: 16px !important; gap: 8px !important; }
          .auth-trust-line { display: none; }
        }

        @media (max-width: 480px) and (max-height: 740px) {
          .auth-root { padding-top: 24px !important; }
          .auth-mochi img { width: 90px !important; height: 90px !important; }
          .auth-headline { font-size: 22px !important; }
          .auth-card { padding: 14px !important; }
          .auth-footer { margin-top: 12px !important; }
        }

        @media (min-width: 481px) and (max-height: 860px) {
          .auth-root {
            padding-top: 48px !important;
            padding-bottom: 24px !important;
          }
          .auth-trust-line { display: none; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
