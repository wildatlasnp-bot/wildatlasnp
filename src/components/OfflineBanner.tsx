import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OFFLINE_CACHE_KEY = "wildatlas_sniper_cache";

/** Cache alert settings to localStorage for offline resilience */
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
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/25">
            <WifiOff size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[12px] font-medium text-amber-700 dark:text-amber-300 leading-snug">
              You're offline — showing last known data
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
