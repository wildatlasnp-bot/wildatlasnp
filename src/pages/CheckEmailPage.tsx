import { useState } from "react";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const email = (location.state as any)?.email as string | undefined;
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      setResent(true);
      toast({ title: "📬 Email sent!", description: "Check your inbox for a fresh confirmation link." });
    } catch (e: any) {
      toast({ title: "🐻 Trail hiccup", description: "Couldn't resend the email. Try again in a moment." });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-16 h-16 rounded-full bg-[#F0EDEA] flex items-center justify-center mx-auto mb-6"
        >
          <Mail size={28} className="text-primary" />
        </motion.div>

        <h1 className="text-2xl font-heading font-bold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
          We sent a confirmation link to{" "}
          {email ? <span className="font-medium text-foreground">{email}</span> : "your inbox"}.
          Click it to activate your account and start getting permit alerts.
        </p>

        <div className="mt-8 space-y-3">
          <div className="rounded-xl p-4 text-left" style={{ backgroundColor: '#F5F2EE' }}>
            <p className="text-xs font-semibold text-foreground mb-1">Don't see it?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Check your spam or junk folder</li>
              <li>• Make sure you entered the right email</li>
              <li>• Allow a few minutes for delivery</li>
            </ul>
          </div>

          {email && (
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
              {resent ? "Email resent ✓" : "Resend verification email"}
            </button>
          )}

          <button
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-3"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckEmailPage;
