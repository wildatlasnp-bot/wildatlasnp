import { useState, useCallback, useEffect, useRef } from "react";
import { LogIn, Radar, X, Clock, Zap } from "lucide-react";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import ScannerStatusCard from "@/components/ScannerStatusCard";
import SniperHeader from "@/components/SniperHeader";

import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import PermitFeed from "@/components/PermitFeed";
import ParkAlerts from "@/components/ParkAlerts";


interface SniperProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
}

const SniperDashboard = ({ parkId: parkIdProp, onParkChange }: SniperProps = {}) => {
  const navigate = useNavigate();
  const s = useSniperData(parkIdProp, onParkChange);
  const recentFinds = useRecentFinds(s.parkId);

  const INTRO_KEY = DISMISSABLE_KEYS[0]; // "wildatlas_sniper_intro_dismissed"
  const hasActiveWatches = s.activeCount > 0;
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    localStorage.setItem(INTRO_KEY, "1");
  }, [INTRO_KEY]);

  // Auto-collapse intro once user tracks their first permit
  useEffect(() => {
    if (hasActiveWatches && showIntro) {
      dismissIntro();
    }
  }, [hasActiveWatches, showIntro, dismissIntro]);

  // Sticky collapsed status bar
  const statusCardRef = useRef<HTMLDivElement>(null);
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  useEffect(() => {
    const el = statusCardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStatusCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isActive = s.scannerStatus === "active";
  const isDelayed = s.scannerStatus === "delayed";
  const stickyLabel = isActive
    ? "Monitoring"
    : isDelayed
    ? "Scanner delayed"
    : "Connecting…";
  const stickyDot = isDelayed ? "bg-status-busy" : "bg-status-quiet";
  const stickyText = isDelayed ? "text-status-busy" : "text-status-quiet";

  return (
    <div className="flex flex-col h-full overflow-y-auto relative">
      {/* Sticky collapsed status bar */}
      <AnimatePresence>
        {statusCollapsed && (
          <motion.div
            initial={{ y: -32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -32, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-0 z-30 px-5 py-2 bg-background/90 backdrop-blur-md border-b border-border/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  {isActive && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${stickyDot} opacity-50`} style={{ animationDuration: "1.6s" }} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${stickyDot}`} />
                </span>
                <span className={`text-[11px] font-bold ${stickyText}`}>{stickyLabel}</span>
                {s.activeCount > 0 && (
                  <span className="text-[10px] text-muted-foreground font-medium">· {s.activeCount} tracked</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {s.lastChecked && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                    <Clock size={8} />
                    {s.getTimeAgo(s.lastChecked)}
                  </span>
                )}
                {recentFinds.lastFound && (
                  <span className="flex items-center gap-1 text-[10px] text-status-found font-semibold">
                    <Zap size={8} />
                    {s.getTimeAgo(recentFinds.lastFound)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Scanner status + park selector */}
      <SniperHeader
        parkId={s.parkId}
        activeCount={s.activeCount}
        lastChecked={s.lastChecked}
        scanPulse={s.scanPulse}
        refreshing={s.refreshing}
        scannerStale={s.scannerStale}
        scannerStatus={s.scannerStatus}
        getTimeAgo={s.getTimeAgo}
        onParkChange={s.handleParkChange}
        onRefresh={s.fetchAvailability}
      />

      {/* 2. System Status */}
      <div ref={statusCardRef} className="px-5 mb-6">
        <ScannerStatusCard
          scannerStatus={s.scannerStatus}
          lastChecked={s.lastChecked}
          lastFound={recentFinds.lastFound}
          activeCount={s.activeCount}
          getTimeAgo={s.getTimeAgo}
        />
      </div>

      {/* Intro banner for first-time users */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="px-5 mb-6"
          >
            <div className="relative rounded-xl border border-border/70 bg-muted/30 p-4">
              <button
                onClick={dismissIntro}
                className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss intro"
              >
                <X size={12} />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Radar size={13} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[12px] font-bold text-muted-foreground leading-snug">How It Works</h3>
                  <ul className="mt-2.5 space-y-2.5 text-[11px] text-muted-foreground/80 leading-relaxed font-medium">
                    <li><span className="font-bold text-foreground/60">1.</span> Tap a permit to track</li>
                    <li><span className="font-bold text-foreground/60">2.</span> Scanner checks every 2 min</li>
                    <li><span className="font-bold text-foreground/60">3.</span> Get notified on cancellations</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Permit Tracking */}
      <div className="px-5 space-y-5 pb-7">
        <p className="section-header">Permit Tracking</p>

        {/* Empty state */}
        {s.activeCount === 0 && !s.permitDefs.length && (
          <div className="rounded-xl border border-border/70 bg-card px-5 py-6 text-center" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-[15px] font-bold text-foreground">No permits tracked yet</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">Track a permit to start scanning for cancellations.</p>
          </div>
        )}

        {s.permitDefs.map((permit, i) => (
          <div key={permit.name} id={`permit-card-${permit.name}`}>
            <WatchCard
              permit={permit}
              watch={s.getWatchState(permit.name)}
              availability={s.getAvailability(permit.name)}
              lastFind={recentFinds.lastFindByPermit[permit.name] ?? null}
              index={i}
              isLoading={s.loadingId === permit.name}
              hasPhone={s.hasPhone}
              isPro={s.isPro}
              userId={s.user?.id ?? ""}
              showPhoneInput={s.showPhoneInput}
              getTimeAgo={s.getTimeAgo}
              onToggleWatch={s.toggleWatch}
              onDeleteWatch={s.deleteWatch}
              onToggleNotify={s.toggleNotify}
              onTogglePhoneInput={s.setShowPhoneInput}
              onPhoneSaved={s.handlePhoneSaved}
              onUpgrade={() => s.setProModalOpen(true)}
            />
          </div>
        ))}

        {!s.user && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 text-secondary py-3.5 text-[13px] font-bold hover:bg-secondary/20 active:scale-[0.98] transition-all"
          >
            <LogIn size={14} />
            Sign up to start tracking permits
          </motion.button>
        )}
      </div>

      {/* 4. Recent Finds */}
      <div className="mb-2">
        <PermitFeed recentFinds={recentFinds} />
      </div>

      {/* 5. NPS Alerts */}
      <ParkAlerts parkId={s.parkId} />

      <PermitSuccessOverlay
        open={s.successOpen}
        onClose={() => s.setSuccessOpen(false)}
        permitName={s.foundPermit?.name}
        permitDate={s.foundPermit?.date}
      />
      <ProModal open={s.proModalOpen} onOpenChange={s.setProModalOpen} />
    </div>
  );
};

export default SniperDashboard;