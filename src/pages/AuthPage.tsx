import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import mochiImg from "@/assets/mochi-scanning.png";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000;


const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const attemptsRef = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div
      className="wa-root"
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
        padding: "24px 24px 24px",
        background: "linear-gradient(180deg, #2c3a2e 0%, #3d4a3a 18%, #6b7562 36%, #a09b88 54%, #c8c1ad 70%, #ddd7c6 84%, #e8e2d2 100%)",
      }}
    >
      {/* Ambient light overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 80% 50% at 30% 15%, rgba(255,255,255,0.12) 0%, transparent 60%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Terrain layers — softened topographic feel */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%", pointerEvents: "none", zIndex: 0 }} viewBox="0 0 800 320" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,320 L0,200 Q100,160 200,140 Q300,120 400,100 Q500,115 600,90 Q700,110 800,80 L800,320Z" fill="#c8bf9e" opacity="0.18"/>
        <path d="M0,320 L0,240 Q120,210 240,195 Q360,180 480,170 Q600,182 720,165 L800,172 L800,320Z" fill="#bfb89f" opacity="0.15"/>
        <path d="M0,320 L0,270 Q150,252 300,245 Q450,238 600,242 Q700,235 800,240 L800,320Z" fill="#b5ae96" opacity="0.12"/>
      </svg>

      {/* Content wrapper */}
      <div
        className="wa-content"
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 600ms ease, transform 600ms ease",
        }}
      >
        {/* Logo */}
        <div
          className="wa-logo"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 22,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 17 L11 6 L18 17" stroke="#8aad94" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            <path d="M7 17 L11 10 L15 17" stroke="#a3c4ad" strokeWidth="1" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>
            WildAtlas
          </span>
        </div>

        {/* Headline */}
        <h1
          className="wa-headline"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(30px, 8vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#f4f1ea",
            textAlign: "left",
            margin: "0 0 10px",
            letterSpacing: "-0.025em",
          }}
        >
          {isSignUp ? "Create your account" : "Never miss a permit again."}
        </h1>

        <p
          className="wa-subtext"
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.48)",
            textAlign: "left",
            margin: "0 0 28px",
            lineHeight: 1.55,
            fontWeight: 400,
            letterSpacing: "0.005em",
          }}
        >
          {isSignUp
            ? "Sign up to start getting permit alerts."
            : "Real-time alerts. No refreshing. No guessing."}
        </p>

        {/* Card */}
        <div
          className="wa-card"
          style={{
            width: "100%",
            background: "linear-gradient(180deg, #f7f5f0 0%, #f1efe8 100%)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderTop: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 16,
            padding: "24px 22px",
            boxSizing: "border-box",
            boxShadow: "0 1px 0 rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          {/* Google button */}
          <button
            className="wa-google-btn"
            onClick={handleGoogle}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 10,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 14,
              fontWeight: 500,
              color: "#1a2a1f",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#faf8f4"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#a8a090", letterSpacing: "0.01em" }}>
            No spam. No noise. Just alerts.
          </p>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.045)" }} />
            <span style={{ fontSize: 10, color: "#bab2a2", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.045)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isSignUp && (
              <input
                className="wa-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 10,
                  padding: "0 16px",
                  fontSize: 14,
                  color: "#1a2a1f",
                  background: "#eae6da",
                  border: "1px solid rgba(0,0,0,0.04)",
                  outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                  boxSizing: "border-box",
                  transition: "background 140ms ease, border-color 180ms ease, box-shadow 180ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(47,111,78,0.4)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04), 0 0 0 3px rgba(47,111,78,0.08)";
                  e.currentTarget.style.background = "#edead0";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,0,0,0.04)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04)";
                  e.currentTarget.style.background = "#eae6da";
                }}
              />
            )}
            <input
              className="wa-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              style={{
                width: "100%",
                height: 46,
                borderRadius: 10,
                padding: "0 16px",
                fontSize: 14,
                color: "#1a2a1f",
                background: "#eae6da",
                border: "1px solid rgba(0,0,0,0.04)",
                outline: "none",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                boxSizing: "border-box",
                transition: "background 140ms ease, border-color 180ms ease, box-shadow 180ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(47,111,78,0.4)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04), 0 0 0 3px rgba(47,111,78,0.08)";
                e.currentTarget.style.background = "#edead0";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.04)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04)";
                e.currentTarget.style.background = "#eae6da";
              }}
            />
            <input
              className="wa-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              style={{
                width: "100%",
                height: 46,
                borderRadius: 10,
                padding: "0 16px",
                fontSize: 14,
                color: "#1a2a1f",
                background: "#eae6da",
                border: "1px solid rgba(0,0,0,0.04)",
                outline: "none",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                boxSizing: "border-box",
                transition: "background 140ms ease, border-color 180ms ease, box-shadow 180ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(47,111,78,0.4)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04), 0 0 0 3px rgba(47,111,78,0.08)";
                e.currentTarget.style.background = "#edead0";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.04)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.04)";
                e.currentTarget.style.background = "#eae6da";
              }}
            />

            {/* Green CTA */}
            <button
              className="wa-submit"
              type="submit"
              disabled={loading}
              style={{
                marginTop: 2,
                width: "100%",
                height: 50,
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                color: "#e8e4d8",
                background: "linear-gradient(180deg, #2d6848 0%, #24503a 100%)",
                border: "1px solid rgba(0,0,0,0.08)",
                letterSpacing: "-0.2px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 14px rgba(36,80,58,0.3), 0 1px 3px rgba(0,0,0,0.1)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.55 : 1,
                transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.04)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(0) scale(0.985)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            >
              {loading ? "…" : isSignUp ? "Get Permit Alerts →" : "Start tracking →"}
            </button>
          </form>
        </div>

        {/* Footer links — outside card */}
        <div style={{ marginTop: 16, width: "100%", textAlign: "center" }}>
          {!isSignUp && (
            <button
              onClick={handleForgotPassword}
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Forgot password?
            </button>
          )}
          <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            {isSignUp ? "Have an account? " : "New to WildAtlas? "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
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

      {/* Mochi — grounded bottom-right */}
      <img
        className="wa-mochi"
        src={mochiImg}
        alt="Mochi the bear scanning permits"
        style={{
          position: "fixed",
          bottom: 0,
          right: "20px",
          width: "120px",
          height: "auto",
          zIndex: 10,
          pointerEvents: "none",
          filter: "drop-shadow(0 -2px 8px rgba(0,0,0,0.08))",
          opacity: 0.88,
          mixBlendMode: "multiply" as const,
        }}
      />
      {/* Mochi ground shadow */}
      <div style={{
        position: "fixed",
        bottom: 2,
        right: 28,
        width: 100,
        height: 12,
        borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.1) 0%, transparent 70%)",
        zIndex: 9,
        pointerEvents: "none",
      }} />

      <style>{`
        input.wa-input::placeholder { color: #a09480 !important; }

        @media (max-width: 480px) {
          .wa-root { padding: 20px 16px 20px !important; }
          .wa-headline { font-size: 28px !important; }
          .wa-card { padding: 20px 18px !important; border-radius: 14px !important; }
          .wa-google-btn { height: 46px !important; }
          .wa-submit { height: 48px !important; }
          img.wa-mochi { width: 100px !important; right: 12px !important; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
