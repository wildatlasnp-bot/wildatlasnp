import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, ArrowRight, Mountain } from "lucide-react";
import { motion } from "framer-motion";
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

  return (
    <>
    <style>{`.auth-input::placeholder { color: rgba(245,241,236,0.25) !important; }`}</style>
    <div
      className="min-h-svh w-full flex flex-col items-center justify-center px-5 py-12 font-body"
      style={{
        background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(47,111,78,0.15) 0%, transparent 60%), radial-gradient(ellipse 100% 100% at 50% 50%, #111A0E 0%, #0A0F08 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[420px] flex flex-col items-stretch rounded-2xl px-8 py-10"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(196,169,106,0.18)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8" style={{ gap: 8 }}>
          <img
            src={wildatlasLogo}
            alt="WildAtlas"
            width={96}
            className="block"
            style={{ height: "auto", mixBlendMode: "lighten" }}
          />
          <span
            className="text-[11px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: "rgba(196,169,106,0.7)" }}
          >
            WILDATLAS
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-[2rem] font-bold leading-[1.12] text-center mb-2 tracking-tight">
          {isSignUp ? (
            <span style={{ color: "#F5F1EC" }}>Create your account</span>
          ) : (
            <>
              <span style={{ color: "#F5F1EC" }}>Never miss a </span>
              <span className="italic" style={{ color: "#D4BC8A" }}>permit again.</span>
            </>
          )}
        </h1>

        <p
          className="text-[13px] text-center mb-8 leading-relaxed font-normal tracking-wide"
          style={{ color: "rgba(245,241,236,0.38)" }}
        >
          {isSignUp
            ? "Sign up to start getting permit alerts."
            : "Real-time alerts. No refreshing. No guessing."}
        </p>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-[13.5px] font-medium transition-all mb-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(196,169,106,0.20)",
            color: "rgba(245,241,236,0.75)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: "rgba(245,241,236,0.07)" }} />
          <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium" style={{ color: "rgba(245,241,236,0.25)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "rgba(245,241,236,0.07)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 mb-4">
          {isSignUp && (
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,241,236,0.25)" }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-[13.5px] font-normal outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,241,236,0.09)",
                  color: "rgba(245,241,236,0.88)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(196,169,106,0.45)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(245,241,236,0.09)"}
              />
            </div>
          )}
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,241,236,0.25)" }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-[13.5px] font-normal outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(245,241,236,0.09)",
                color: "rgba(245,241,236,0.88)",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(196,169,106,0.45)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "rgba(245,241,236,0.09)"}
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,241,236,0.25)" }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="auth-input w-full rounded-xl py-3.5 pl-11 pr-4 text-[13.5px] font-normal outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(245,241,236,0.09)",
                color: "rgba(245,241,236,0.88)",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(196,169,106,0.45)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "rgba(245,241,236,0.09)"}
            />
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1.5 mb-6 w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-[14px] font-bold uppercase tracking-[0.06em] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "#2F6F4E",
              color: "#FFFFFF",
              boxShadow: "0 10px 25px -5px rgba(47,110,76,0.25)",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#265E41"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#2F6F4E"; }}
          >
            {loading ? "…" : (
              <>
                {isSignUp ? "GET PERMIT ALERTS" : "START TRACKING"}
                <ArrowRight size={15} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="w-full flex flex-col items-center gap-2.5">
          {!isSignUp && (
            <button
              onClick={handleForgotPassword}
              className="text-[12.5px] font-normal bg-transparent border-none cursor-pointer transition-colors"
              style={{ color: "rgba(245,241,236,0.30)" }}
            >
              Forgot password?
            </button>
          )}
          <p className="text-[12.5px] font-normal text-center m-0" style={{ color: "rgba(245,241,236,0.30)" }}>
            {isSignUp ? "Have an account? " : "New to WildAtlas? "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-semibold bg-transparent border-none cursor-pointer text-[12.5px] transition-colors"
              style={{ color: "#C4A96A" }}
            >
              {isSignUp ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>

        {/* Bottom badge */}
        <div className="mt-8 pt-6 w-full flex items-center justify-center gap-1.5" style={{ borderTop: "1px solid rgba(245,241,236,0.07)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-soft shrink-0" style={{ background: "#2F6F4E" }} />
          <span className="text-[10.5px] tracking-[0.1em] uppercase font-medium" style={{ color: "rgba(245,241,236,0.20)" }}>
            MONITORING 8 NATIONAL PARKS
          </span>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default AuthPage;
