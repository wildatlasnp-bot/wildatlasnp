import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const CheckEmailPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-16 h-16 rounded-full bg-secondary/15 flex items-center justify-center mx-auto mb-6"
        >
          <Mail size={28} className="text-secondary" />
        </motion.div>

        <h1 className="text-2xl font-heading font-bold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
          We sent a confirmation link to your inbox. Click it to activate your account and start getting permit alerts.
        </p>

        <div className="mt-8 space-y-3">
          <div className="bg-card border border-border rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-foreground mb-1">Don't see it?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Check your spam or junk folder</li>
              <li>• Make sure you entered the right email</li>
              <li>• Allow a few minutes for delivery</li>
            </ul>
          </div>

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
