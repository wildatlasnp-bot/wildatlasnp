import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const DEV_PIN = "5568";
const STORAGE_KEY = "wildatlas_dev_access";

const DevGate = ({ children }: { children: React.ReactNode }) => {
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === DEV_PIN) {
      setAuthorized(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === DEV_PIN) {
      localStorage.setItem(STORAGE_KEY, DEV_PIN);
      setAuthorized(true);
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1500);
    }
  };

  if (checking) return null;
  if (authorized) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-xs w-full"
      >
        <div className="text-5xl mb-4"></div>
        <h1 className="text-lg font-heading font-bold text-foreground mb-1">
          WildAtlas is cooking
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter the access code to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            autoFocus
            className={`w-full text-center text-2xl tracking-[0.3em] font-mono py-3 px-4 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
              error ? "border-destructive ring-2 ring-destructive/30" : "border-border"
            }`}
          />
          <button
            type="submit"
            disabled={pin.length === 0}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Enter
          </button>
        </form>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-destructive mt-3"
          >
            Wrong code — try again.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

export default DevGate;
