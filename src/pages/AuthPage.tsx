import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import mochiImg from "@/assets/mochi-scanning.png";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000;

const PARKS = [
  "Yosemite Half Dome",
  "Zion Narrows",
  "Glacier Going-to-the-Sun",
  "Rocky Mountain Bear Lake",
  "Grand Canyon Rim-to-Rim",
  "Joshua Tree Cholla Garden",
  "Arches Delicate Arch",
  "Olympic Hurricane Ridge",
  "Acadia Cadillac Summit",
  "Smoky Mountains Alum Cave",
  "Bryce Canyon Navajo Loop",
  "Canyonlands Needles",
  "Mount Rainier Skyline Trail",
  "Shenandoah Old Rag",
  "Grand Teton Cascade Canyon",
];

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
        justifyContent: "flex-start",
        overflow: "hidden",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        boxSizing: "border-box",
        padding: "48px 24px 24px",
        background: "radial-gradient(circle at 25% 8%, rgba(255,255,255,0.45) 0%, transparent 45%), linear-gradient(180deg, #e9e4d8 0%, #e2dccb 100%)",
      }}
    >
      {/* Centered content */}
      <div
        className="wa-content"
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      >
        {/* Logo */}
        <div
          className="wa-logo"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 28,
            alignSelf: "flex-start",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="6" fill="rgba(255,255,255,0.12)" />
            <path d="M4 17 L11 6 L18 17" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            <path d="M7 17 L11 10 L15 17" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)", letterSpacing: "0.01em" }}>
            WildAtlas
          </span>
        </div>

        {/* Headline */}
        <h1
          className="wa-headline"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(32px, 7vw, 48px)",
            fontWeight: 800,
            lineHeight: 1.08,
            color: "#1a2a1f",
            textAlign: "left",
            alignSelf: "flex-start",
            maxWidth: 420,
            marginBottom: 8,
            letterSpacing: "-0.4px",
          }}
        >
          {isSignUp ? "Create your account" : "Never miss a permit again."}
        </h1>

        <p
          className="wa-subtext"
          style={{
            fontSize: 15,
            color: "#7a867c",
            textAlign: "left",
            alignSelf: "flex-start",
            maxWidth: 420,
            marginBottom: 32,
            lineHeight: 1.5,
            fontWeight: 300,
            letterSpacing: "0.01em",
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
            maxWidth: 420,
            background: "#f6f4ee",
            border: "1px solid rgba(0,0,0,0.07)",
            borderTop: "1px solid rgba(255,255,255,0.5)",
            borderRadius: 14,
            padding: "26px 24px 22px",
            boxSizing: "border-box",
            boxShadow: "0 20px 60px rgba(0,0,0,0.09), 0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.55)",
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          {/* Google button */}
          <button
            className="wa-google-btn"
            onClick={handleGoogle}
            style={{
              width: "100%",
              height: 50,
              borderRadius: 10,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 14,
              fontWeight: 500,
              color: "#1a2a1f",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f9f7f2"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#a09480" }}>
            No spam. No noise. Just alerts.
          </p>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "#e8e2d6" }} />
            <span style={{ fontSize: 11, color: "#a09480", letterSpacing: "0.05em" }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: "#e8e2d6" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  height: 48,
                  borderRadius: 10,
                  padding: "0 16px",
                  fontSize: 14,
                  color: "#1a2a1f",
                  background: "#e7e2d6",
                  border: "none",
                  outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                  boxSizing: "border-box",
                  transition: "background 140ms ease, outline-color 140ms ease, box-shadow 140ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = "1.5px solid #2f6f4e";
                  e.currentTarget.style.background = "#ebe7dc";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                  e.currentTarget.style.background = "#e7e2d6";
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
                height: 48,
                borderRadius: 10,
                padding: "0 16px",
                fontSize: 14,
                color: "#1a2a1f",
                background: "#e7e2d6",
                border: "none",
                outline: "none",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                boxSizing: "border-box",
                transition: "background 140ms ease, outline-color 140ms ease, box-shadow 140ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "1.5px solid #2f6f4e";
                e.currentTarget.style.background = "#ebe7dc";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.background = "#e7e2d6";
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
                height: 48,
                borderRadius: 10,
                padding: "0 16px",
                fontSize: 14,
                color: "#1a2a1f",
                background: "#e7e2d6",
                border: "none",
                outline: "none",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                boxSizing: "border-box",
                transition: "background 140ms ease, outline-color 140ms ease, box-shadow 140ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "1.5px solid #2f6f4e";
                e.currentTarget.style.background = "#ebe7dc";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.background = "#e7e2d6";
              }}
            />

            {/* Green CTA */}
            <button
              className="wa-submit"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 52,
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                color: "#f2eddf",
                background: "linear-gradient(180deg, #2a6545 0%, #285a40 100%)",
                border: "none",
                letterSpacing: "-0.2px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px rgba(47,111,78,0.28)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.55 : 1,
                transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.06)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(0) scale(0.985)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            >
              {loading ? "…" : isSignUp ? "Get Permit Alerts →" : "Start tracking →"}
            </button>
          </form>

          {!isSignUp && (
            <button
              onClick={handleForgotPassword}
              style={{
                marginTop: 14,
                fontSize: 12,
                color: "#7a7060",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Forgot password?
            </button>
          )}
          <p style={{ marginTop: 8, fontSize: 12, color: "#7a7060", textAlign: "center" }}>
            {isSignUp ? "Have an account? " : "New to WildAtlas? "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                fontWeight: 600,
                color: "#2d5a3d",
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

      {/* Mochi image — direct child of root */}
      <img
        className="wa-mochi"
        src={mochiImg}
        alt="Mochi the bear scanning permits"
        style={{
          position: "fixed",
          bottom: "0",
          right: "28px",
          width: "155px",
          height: "auto",
          zIndex: 50,
          pointerEvents: "none",
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.14))",
          transform: "translateZ(0)",
        }}
      />

      {/* Scrolling park ticker */}
      <div
        className="wa-ticker"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 3,
          overflow: "hidden",
          background: "rgba(226,220,203,0.95)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "8px 0",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          className="wa-ticker-track"
          style={{
            display: "flex",
            gap: 40,
            width: "max-content",
            animation: "wa-scroll 28s linear infinite",
          }}
        >
          {[...PARKS, ...PARKS].map((park, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                color: "#9a8f7e",
                whiteSpace: "nowrap",
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ color: "#b8a88a", marginRight: 6 }}>●</span>
              {park}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        input.wa-input::placeholder { color: #a09480 !important; }

        @keyframes wa-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        @keyframes wa-proof-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .wa-proof-dot { animation: wa-proof-pulse 2s ease-in-out infinite; }

        @media (max-width: 480px) {
          .wa-root { padding: 24px 16px 100px !important; }
          .wa-headline { font-size: 28px !important; }
          .wa-card { padding: 16px !important; border-radius: 12px !important; }
          .wa-google-btn { height: 46px !important; }
          .wa-submit { height: 48px !important; }
          img.wa-mochi { width: 100px !important; right: 16px !important; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
