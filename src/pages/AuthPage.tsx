import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Mail, Lock, User, ArrowRight, Mountain } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

/* ── starfield dots ── */
const stars = [
  { top: "8%", left: "72%", size: 1.5, opacity: 0.6 },
  { top: "14%", left: "28%", size: 1, opacity: 0.45 },
  { top: "22%", left: "85%", size: 2, opacity: 0.75 },
  { top: "18%", left: "50%", size: 1, opacity: 0.35 },
  { top: "30%", left: "15%", size: 1.5, opacity: 0.55 },
  { top: "10%", left: "92%", size: 1, opacity: 0.5 },
  { top: "35%", left: "65%", size: 2, opacity: 0.4 },
  { top: "5%", left: "40%", size: 1, opacity: 0.6 },
];

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
  const isMobile = useIsMobile();

  const isRateLimited = (): boolean => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
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
      toast({ title: "🐻 Trail hiccup", description: e.message?.includes("Invalid") ? "Double-check your email and password." : "I'm having trouble reaching the park gates. Give me a moment!" });
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

  const inputStyle =
    `w-full ${isMobile ? "rounded-[10px]" : "rounded-lg"} py-[11px] px-[14px] text-[13px] outline-none transition-all duration-200 placeholder:select-none` +
    ` ${isMobile ? "bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.15)]" : "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.09)]"}` +
    " text-[rgba(255,255,255,0.85)] placeholder:text-[rgba(255,255,255,0.2)]" +
    " focus:border-[rgba(106,191,106,0.45)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(106,191,106,0.06)]";

  return (
    <div
      className="min-h-screen grid grid-cols-1 md:grid-cols-2"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ═══════ LEFT PANEL ═══════ */}
      <div
        className="hidden md:flex flex-col relative overflow-hidden"
        style={{ background: "#0e1a0e", padding: "36px 32px" }}
      >
        {/* ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -60, right: -60, width: 260, height: 260,
            background: "radial-gradient(circle, rgba(74,160,74,0.12) 0%, transparent 70%)",
          }}
        />
        {/* radar sweep */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 0, left: 0, bottom: 0, width: "14%",
            background: "linear-gradient(90deg, transparent, rgba(106,191,106,0.06), transparent)",
            animation: "auth-sweep 16s linear infinite",
          }}
        />
        {/* mountain silhouette */}
        <svg
          className="absolute pointer-events-none left-0 right-0 bottom-0 w-full"
          style={{ height: 180 }}
          viewBox="0 0 320 180"
          preserveAspectRatio="xMidYMax meet"
        >
          <path d="M0 180 L0 130 L40 90 L80 115 L130 55 L175 95 L210 70 L255 100 L290 75 L320 95 L320 180 Z" fill="rgba(255,255,255,0.025)" />
          <path d="M0 180 L0 150 L55 110 L100 135 L155 80 L200 115 L240 90 L280 115 L320 100 L320 180 Z" fill="rgba(255,255,255,0.018)" />
        </svg>
        {/* ghost wordmark */}
        <div
          className="absolute pointer-events-none select-none whitespace-nowrap"
          style={{
            bottom: 16, left: -6, fontFamily: "'Playfair Display', serif",
            fontSize: 72, fontWeight: 500, color: "rgba(255,255,255,0.035)", lineHeight: 1,
          }}
        >
          Wild<br />Atlas
        </div>
        {/* starfield */}
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute pointer-events-none rounded-full bg-white"
            style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}

        {/* ── content z-2 ── */}
        {/* logo row — pinned top */}
        <div className="absolute z-[2] flex items-center gap-2" style={{ top: 36, left: 32 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.14)",
              }}
            >
              <Mountain size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
            </div>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                fontWeight: 500, color: "rgba(255,255,255,0.7)",
              }}
            >
              WildAtlas
            </span>
        </div>

        {/* copy block — pinned above badge */}
        <div className="absolute z-[2]" style={{ bottom: 280, left: 32, right: 32 }}>
            <p
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: 9,
                color: "rgba(106,191,106,0.6)", textTransform: "uppercase",
                letterSpacing: "0.18em", marginBottom: 12,
              }}
            >
              National park permits
            </p>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(34px, 3vw, 40px)", fontWeight: 500,
                color: "#fff", lineHeight: 1.15, marginBottom: 12,
              }}
            >
              Never miss a permit<br />to your favorite parks.
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                fontWeight: 300, color: "rgba(255,255,255,0.45)",
                lineHeight: 1.65, maxWidth: 240,
              }}
            >
              WildAtlas watches for openings and cancellations.
            </p>
        </div>

        {/* live badge */}
        <div
          className="absolute flex items-center gap-[5px]"
          style={{
            bottom: 28, left: 32,
            background: "rgba(106,191,106,0.08)",
            border: "0.5px solid rgba(106,191,106,0.22)",
            borderRadius: 20, padding: "4px 10px",
            fontFamily: "'DM Mono', monospace", fontSize: 9,
            color: "rgba(106,191,106,0.82)", letterSpacing: "0.06em",
          }}
        >
          <span
            className="rounded-full"
            style={{
              width: 5, height: 5, background: "#6abf6a",
              animation: "auth-pulse 2.4s ease-in-out infinite",
            }}
          />
          Monitoring active
        </div>
      </div>

      {/* ═══════ RIGHT PANEL ═══════ */}
      <div
        className={`flex flex-col items-center justify-center md:border-l md:shadow-[-8px_0_24px_rgba(0,0,0,0.3)]`}
        style={{
          background: "#141f14",
          padding: isMobile ? "0 28px" : "0 36px",
          height: "100vh",
          minHeight: "100vh",
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            .auth-right-panel {
              background: radial-gradient(circle at 50% -100px, rgba(106,191,106,0.1), transparent 55%), #141f14 !important;
              border-left: 0.5px solid rgba(255,255,255,0.05);
              box-shadow: -8px 0 24px rgba(0,0,0,0.3);
            }
          }
        `}</style>
        <div className="w-full max-w-[360px] auth-right-panel-inner">
          {/* mobile logo */}
          <div className="flex items-center gap-2 md:hidden" style={{ marginBottom: 32 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.14)",
              }}
            >
              <Mountain size={13} style={{ color: "rgba(255,255,255,0.7)" }} />
            </div>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                fontWeight: 500, color: "rgba(255,255,255,0.7)",
              }}
            >
              WildAtlas
            </span>
          </div>

          {/* title */}
          <h1
            style={{
              fontFamily: "'Playfair Display', serif", fontSize: 24,
              fontWeight: 500, color: "#fff", marginBottom: 8,
            }}
          >
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              fontWeight: 300, color: "rgba(255,255,255,0.32)",
              lineHeight: 1.5, marginBottom: 28,
            }}
          >
            {isSignUp
              ? "Sign up to start getting permit alerts."
              : "Sign in to check your alerts and watched parks."}
          </p>

          {/* google */}
          <button
            onClick={handleGoogle}
            className={`w-full flex items-center justify-center gap-2 ${isMobile ? "rounded-[10px]" : "rounded-lg"} transition-colors duration-150`}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.11)",
              borderRadius: isMobile ? 10 : 8, padding: 11,
              fontSize: 13, color: "rgba(255,255,255,0.72)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* divider */}
          <div className="flex items-center gap-3" style={{ marginTop: 20, marginBottom: 20 }}>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: 9,
                color: "rgba(255,255,255,0.18)", textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              or
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {isSignUp && (
              <div className="relative">
                <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.2)" }} />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputStyle + " pl-9"}
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.2)" }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className={inputStyle + " pl-9"}
                required
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.2)" }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className={inputStyle + " pl-9"}
                required
                minLength={6}
              />
            </div>
            <div style={{ height: 10 }} />
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${isMobile ? "rounded-[10px]" : "rounded-lg"} text-[13px] font-medium text-white transition-colors duration-150 disabled:opacity-50`}
              style={{ background: "#1e3a1e", padding: 12, borderRadius: isMobile ? 10 : undefined }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#172e17"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#1e3a1e"; }}
            >
              {isSignUp ? "Get Permit Alerts →" : "Sign in →"}
            </button>
          </form>

          {/* bottom links */}
          <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
            {!isSignUp ? (
              <button
                onClick={handleForgotPassword}
                className="text-[12px] hover:underline"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                Forgot password?
              </button>
            ) : (
              <span />
            )}
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.22)" }}>
              {isSignUp ? "Have an account? " : "New? "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-medium hover:underline"
                style={{ color: "#6abf6a" }}
              >
                {isSignUp ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>

          {/* mobile monitoring badge */}
          {isMobile && (
            <div
              className="flex items-center justify-center gap-[6px]"
              style={{ marginTop: 28 }}
            >
              <span
                className="rounded-full"
                style={{
                  width: 5, height: 5, background: "#6abf6a",
                  animation: "auth-pulse 2.4s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 9,
                  color: "rgba(106,191,106,0.7)", letterSpacing: "0.08em",
                }}
              >
                Monitoring active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes auth-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(700%); }
        }
        @keyframes auth-pulse {
          0%, 100% { transform: scale(1); opacity: .9; }
          50%      { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
