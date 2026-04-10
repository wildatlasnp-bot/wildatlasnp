import { useState, useEffect, useCallback } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const email = (location.state as any)?.email as string | undefined;
  const [justSent, setJustSent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const handleResend = useCallback(async () => {
    if (!email || resending || justSent) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
    } catch {
      toast({ title: "Trail hiccup", description: "Couldn't resend the email. Try again in a moment." });
    } finally {
      setResending(false);
    }
  }, [email, resending, justSent, toast]);

  return (
    <div
      className="min-h-svh bg-background flex flex-col items-center px-5"
      style={{ paddingTop: "30vh", paddingBottom: "40px" }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="flex items-center justify-center mx-auto"
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "#1A2F1E",
          }}
        >
          <Mail size={30} color="#F5F5F0" strokeWidth={1.5} />
        </motion.div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 36,
            fontWeight: 400,
            color: "hsl(var(--foreground))",
            marginTop: 28,
            marginBottom: 0,
            lineHeight: 1.1,
          }}
        >
          Check your email
        </h1>

        {/* Divider */}
        <div
          style={{
            height: 1,
            backgroundColor: "rgba(0,0,0,0.08)",
            margin: "16px auto",
            maxWidth: 200,
          }}
        />

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground max-w-[280px] mx-auto" style={{ lineHeight: 1.6 }}>
          We sent a confirmation link
          {email ? <> to <span className="font-medium text-foreground">{email}</span></> : " to your inbox"}.
          {" "}Click it to activate your account and start getting permit alerts.
        </p>

        {/* Help card */}
        <div
          className="rounded-xl p-4 text-left mt-6"
          style={{
            backgroundColor: "#F0EDEA",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <p className="text-xs font-semibold text-foreground mb-2">Don't see it?</p>
          <ul className="text-xs text-muted-foreground flex flex-col gap-1.5 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the right email</li>
            <li>Allow a few minutes for delivery</li>
          </ul>
        </div>

        {/* Resend link */}
        {email && (
          <div className="mt-5 text-center">
            {justSent ? (
              <p className="text-[13px] font-medium" style={{ color: "#2F6F4E" }}>Email sent ✓</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Didn't get it?{" "}
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="underline font-medium disabled:opacity-50"
                  style={{ color: "#2F6F4E", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                >
                  Resend email
                </button>
              </p>
            )}
          </div>
        )}

        {/* Back */}
        <button
          onClick={() => navigate("/auth")}
          className="flex items-center justify-center gap-1.5 mx-auto mt-8 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default CheckEmailPage;
