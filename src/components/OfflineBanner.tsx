import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OFFLINE_CACHE_KEY = "wildatlas_sniper_cache";

/** Cache sniper settings to localStorage for offline resilience */
export const cacheLocally = (data: unknown) => {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(data));
  } catch {}
};

export const getCachedData = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 max-w-lg mx-auto bg-card border border-border rounded-2xl px-4 py-3.5 shadow-lg flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0 mt-0.5">
            <WifiOff size={18} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-snug">
              You're in the wild!
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              WildAtlas is saving your permit sniper settings locally and will re-sync once you're back in range.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
