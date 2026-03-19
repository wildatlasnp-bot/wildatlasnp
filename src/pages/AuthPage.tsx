import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Mail, Lock, User, Mountain } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const NightSkyBackground = () => (
  <svg
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 0,
      pointerEvents: "none",
    }}
    viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Starfield — upper 50% */}
    <circle cx="32" cy="18" r="0.4" fill="#e8ead4" opacity="0.45" />
    <circle cx="95" cy="72" r="0.65" fill="#e8ead4" opacity="0.6" />
    <circle cx="148" cy="29" r="0.35" fill="#e8ead4" opacity="0.35" />
    <circle cx="210" cy="115" r="0.55" fill="#e8ead4" opacity="0.7" />
    <circle cx="178" cy="268" r="0.8" fill="#e8ead4" opacity="0.5" />
    <circle cx="265" cy="42" r="0.5" fill="#e8ead4" opacity="0.55" />
    <circle cx="305" cy="195" r="0.6" fill="#e8ead4" opacity="0.4" />
    <circle cx="342" cy="88" r="1.8" fill="#e8ead4" opacity="0.75">
      <animate attributeName="opacity" values="0.75;0.25;0.75" dur="4s" begin="0s" repeatCount="indefinite" />
    </circle>
    <circle cx="388" cy="310" r="0.4" fill="#e8ead4" opacity="0.3" />
    <circle cx="425" cy="155" r="0.7" fill="#e8ead4" opacity="0.65" />
    <circle cx="462" cy="22" r="0.55" fill="#e8ead4" opacity="0.8" />
    <circle cx="510" cy="370" r="0.35" fill="#e8ead4" opacity="0.42" />
    <circle cx="538" cy="130" r="0.65" fill="#e8ead4" opacity="0.58" />
    <circle cx="580" cy="248" r="0.5" fill="#e8ead4" opacity="0.72" />
    <circle cx="615" cy="55" r="0.8" fill="#e8ead4" opacity="0.38" />
    <circle cx="660" cy="340" r="0.4" fill="#e8ead4" opacity="0.52" />
    <circle cx="695" cy="168" r="1.5" fill="#e8ead4" opacity="0.85">
      <animate attributeName="opacity" values="0.85;0.2;0.85" dur="5s" begin="1.4s" repeatCount="indefinite" />
    </circle>
    <circle cx="728" cy="415" r="0.55" fill="#e8ead4" opacity="0.33" />
    <circle cx="762" cy="78" r="0.85" fill="#e8ead4" opacity="0.6" />
    <circle cx="800" cy="225" r="0.35" fill="#e8ead4" opacity="0.48" />
    <circle cx="835" cy="12" r="1.6" fill="#e8ead4" opacity="0.7">
      <animate attributeName="opacity" values="0.7;0.15;0.7" dur="6s" begin="2.8s" repeatCount="indefinite" />
    </circle>
    <circle cx="868" cy="295" r="0.5" fill="#e8ead4" opacity="0.55" />
    <circle cx="905" cy="145" r="0.7" fill="#e8ead4" opacity="0.4" />
    <circle cx="940" cy="390" r="0.4" fill="#e8ead4" opacity="0.62" />
    <circle cx="972" cy="58" r="0.6" fill="#e8ead4" opacity="0.78">
      <animate attributeName="opacity" values="0.78;0.25;0.78" dur="4.5s" begin="4s" repeatCount="indefinite" />
    </circle>
    <circle cx="55" cy="188" r="0.8" fill="#e8ead4" opacity="0.43" />
    <circle cx="130" cy="350" r="0.55" fill="#e8ead4" opacity="0.3" />
    <circle cx="1015" cy="205" r="0.35" fill="#e8ead4" opacity="0.67" />
    <circle cx="1042" cy="430" r="0.65" fill="#e8ead4" opacity="0.35" />
    <circle cx="22" cy="410" r="0.5" fill="#e8ead4" opacity="0.5" />
    <circle cx="490" cy="440" r="0.85" fill="#e8ead4" opacity="0.32" />
    <circle cx="750" cy="355" r="0.4" fill="#e8ead4" opacity="0.74" />
    <circle cx="290" cy="420" r="0.6" fill="#e8ead4" opacity="0.45" />
    <circle cx="638" cy="395" r="0.55" fill="#e8ead4" opacity="0.58" />
    <circle cx="445" cy="285" r="0.7" fill="#e8ead4" opacity="0.82" />
    <circle cx="820" cy="440" r="0.35" fill="#e8ead4" opacity="0.37" />
    <circle cx="115" cy="440" r="0.65" fill="#e8ead4" opacity="0.53" />
    <circle cx="985" cy="330" r="0.5" fill="#e8ead4" opacity="0.68" />
    <circle cx="555" cy="48" r="0.8" fill="#e8ead4" opacity="0.41" />
    <circle cx="1055" cy="105" r="0.55" fill="#e8ead4" opacity="0.76" />

    {/* Mountain silhouettes */}
    <polygon
      points="0,620 0,480 60,460 140,420 200,440 280,405 340,430 420,410 500,425 560,408 640,435 700,415 780,440 840,412 920,445 980,420 1060,438 1120,410 1200,450 1280,425 1360,405 1440,430 1440,620"
      fill="#122010"
      opacity="0.4"
    />
    <polygon
      points="0,620 0,530 80,510 150,490 220,515 300,485 380,505 460,480 540,500 600,475 680,510 760,490 840,520 900,495 980,510 1060,488 1140,515 1220,495 1300,520 1380,500 1440,510 1440,620"
      fill="#1a2e18"
      opacity="0.6"
    />
    <polygon
      points="0,620 0,570 100,555 200,565 300,550 400,560 500,545 600,555 700,540 800,558 900,548 1000,560 1100,550 1200,562 1300,555 1440,560 1440,620"
      fill="#1e3a1e"
      opacity="0.8"
    />
  </svg>
);

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

  const inputStyle: React.CSSProperties = {
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
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(106,191,133,0.4)";
    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(106,191,133,0.25)";
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div
      className="auth-root flex flex-col items-center justify-center"
      style={{
        background: "#080e10",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        minHeight: "100vh",
        boxSizing: "border-box",
        paddingTop: 32,
        paddingBottom: 32,
        paddingLeft: 24,
        paddingRight: 24,
        position: "relative",
      }}
    >
      <NightSkyBackground />

      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", position: "relative", zIndex: 1 }}>
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
            : "Real-time alerts. No refreshing. No guessing."}
        </p>

        {/* Card — glass treatment with entrance animation */}
        <div
          className="auth-card auth-card-enter"
          style={{
            background: "rgba(20, 26, 21, 0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 22,
            boxSizing: "border-box",
          }}
        >
          {/* Google CTA */}
          <button
            onClick={handleGoogle}
            className="auth-google-btn w-full flex items-center justify-center gap-2.5"
            style={{
              height: 52,
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.96)",
              transition: "background 150ms ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Reassurance line */}
          <p className="auth-reassurance text-center" style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            No spam. No posting. Cancel anytime.
          </p>

          {/* Divider */}
          <div className="auth-divider flex items-center gap-3" style={{ marginTop: 16, marginBottom: 16 }}>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.22)",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap" as const,
              }}
            >
              or use email
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col">
            {isSignUp && (
              <div className="auth-input-wrap relative" style={{ marginBottom: 12 }}>
                <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  className="auth-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
            )}
            <div className="auth-input-wrap relative" style={{ marginBottom: 12 }}>
              <Mail size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div className="auth-input-wrap auth-input-wrap-last relative" style={{ marginBottom: 16 }}>
              <Lock size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                className="auth-input"
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
            </div>

            {/* Social proof */}
            <p className="text-center" style={{ fontSize: 12, color: "rgba(106,191,106,0.55)", marginBottom: 10 }}>
              Watching 2,000+ permits right now
            </p>

            {/* CTA */}
            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: "#FFFFFF",
                background: "#2f6f4e",
                border: "none",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "background 150ms ease, transform 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#276242";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2f6f4e";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isSignUp ? "Get Permit Alerts →" : "Start tracking →"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="auth-footer flex flex-col items-center" style={{ marginTop: 24, gap: 10 }}>
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

        @keyframes auth-card-fade-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .auth-card-enter {
          animation: auth-card-fade-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (max-width: 480px) {
          .auth-root {
            padding-top: 36px !important;
            padding-bottom: 16px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .auth-logo { margin-bottom: 16px !important; }
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
