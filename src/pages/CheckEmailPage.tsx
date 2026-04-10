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
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "hsl(var(--muted))" }}
        >
          <Mail size={28} className="text-primary" />
        </motion.div>

        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
            We sent a confirmation link
            {email ? <> to <span className="font-medium text-foreground">{email}</span></> : " to your inbox"}.
            {" "}Click it to activate your account and start getting permit alerts.
          </p>
        </div>

        {/* Help card */}
        <div
          className="rounded-xl p-4 text-left w-full"
          style={{
            backgroundColor: "hsl(var(--muted))",
            border: "0.5px solid hsl(var(--border))",
          }}
        >
          <p className="text-xs font-semibold text-foreground mb-2">Don't see it?</p>
          <ul className="text-xs text-muted-foreground flex flex-col gap-1.5 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the right email</li>
            <li>Allow a few minutes for delivery</li>
          </ul>
        </div>

        {/* Text links */}
        <div className="flex flex-col items-center gap-4">
          {email && (
            justSent ? (
              <p className="text-xs font-medium" style={{ color: "#2F6F4E" }}>Email sent ✓</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Didn't get it?{" "}
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="underline font-medium disabled:opacity-50"
                  style={{ color: "#2F6F4E", background: "none", border: "none", cursor: "pointer" }}
                >
                  Resend email
                </button>
              </p>
            )
          )}

          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckEmailPage;
