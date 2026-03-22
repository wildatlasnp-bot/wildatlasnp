import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Mail, Lock, User, Crosshair } from "lucide-react";
import wildatlasLogo from "@/assets/wildatlas-logo.png";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000;

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
    width: "100%",
    background: "#F5F3F0",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 15,
    color: "#1a2a1f",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 180ms ease",
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)";
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)";
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100svh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: "'DM Sans', 'Instrument Sans', system-ui, sans-serif",
        boxSizing: "border-box",
        padding: "24px",
        background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(47,111,78,0.15) 0%, transparent 60%), radial-gradient(ellipse 100% 100% at 50% 50%, #111A0E 0%, #0A0F08 100%)",
      }}
    >

      {/* Content wrapper */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            marginBottom: 28,
            gap: 12,
          }}
        >
          <img src={wildatlasLogo} alt="WildAtlas" width={64} style={{ display: "block" }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(196,169,106,0.7)", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            WILDATLAS
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 36,
            fontWeight: 300,
            lineHeight: 1.12,
            color: "#F5F1EC",
            textAlign: "center",
            margin: "0 0 8px",
            letterSpacing: "-0.01em",
            width: "100%",
          }}
        >
          {isSignUp ? "Create your account" : (
            <>
              Never miss a<br />
              <em style={{ fontStyle: "italic", color: "#D4BC8A" }}>permit again.</em>
            </>
          )}
        </h1>

        <p
          style={{
            fontSize: 12.5,
            color: "rgba(245,241,236,0.38)",
            textAlign: "center",
            margin: "0 0 36px",
            lineHeight: 1.55,
            fontWeight: 300,
            letterSpacing: "0.04em",
            width: "100%",
          }}
        >
          {isSignUp
            ? "Sign up to start getting permit alerts."
            : "Real-time alerts. No refreshing. No guessing."}
        </p>

        {/* Glass Card */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(196,169,106,0.18)",
            borderRadius: 20,
            padding: "52px 44px 44px",
            boxSizing: "border-box",
            boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 120px rgba(47,111,78,0.08)",
          }}
        >
          {/* Google button */}
          <button
            onClick={handleGoogle}
            style={{
              width: "100%",
              padding: "13px 20px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(196,169,106,0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 13.5,
              fontWeight: 400,
              letterSpacing: "0.02em",
              color: "rgba(245,241,236,0.75)",
              cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s, color 0.2s",
              marginBottom: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.borderColor = "rgba(196,169,106,0.38)";
              e.currentTarget.style.color = "rgba(245,241,236,0.95)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(196,169,106,0.20)";
              e.currentTarget.style.color = "rgba(245,241,236,0.75)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="rgba(255,255,255,0.85)" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.85)" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(255,255,255,0.85)" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.85)" />
            </svg>
            Continue with Google
          </button>

          {/* OR divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(245,241,236,0.07)" }} />
            <span style={{ fontSize: 10.5, color: "rgba(245,241,236,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(245,241,236,0.07)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {isSignUp && (
              <input
                className="wa-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            )}
            <input
              className="wa-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
            <input
              className="wa-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 16,
                width: "100%",
                padding: 16,
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                background: "#2F6F4E",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.55 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "opacity 160ms ease",
              }}
            >
              {loading ? "…" : (
                <>
                  {isSignUp ? "Get Permit Alerts" : "Start tracking"}
                  <Leaf size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          {/* Footer links — inside card */}
          <div style={{ marginTop: 16, width: "100%", textAlign: "center" }}>
            {!isSignUp && (
              <button
                onClick={handleForgotPassword}
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Forgot password?
              </button>
            )}
            <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
              {isSignUp ? "Have an account? " : "New to WildAtlas? "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
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
        </div>
      </div>

      <style>{`
        input.wa-input::placeholder { color: rgba(0,0,0,0.35) !important; }
        input.wa-input:-webkit-autofill,
        input.wa-input:-webkit-autofill:hover,
        input.wa-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #1a2a1f !important;
          -webkit-box-shadow: 0 0 0px 1000px #F5F3F0 inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
