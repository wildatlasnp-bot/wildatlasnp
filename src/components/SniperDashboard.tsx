import { useState, useCallback } from "react";
import { LogIn, Radar, X } from "lucide-react";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import ScannerStatusCard from "@/components/ScannerStatusCard";
import SniperHeader from "@/components/SniperHeader";
import SniperStats from "@/components/SniperStats";
import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import PermitFeed from "@/components/PermitFeed";
import ParkAlerts from "@/components/ParkAlerts";
import PermitActivity from "@/components/PermitActivity";

interface SniperProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
}

const SniperDashboard = ({ parkId: parkIdProp, onParkChange }: SniperProps = {}) => {
  const navigate = useNavigate();
  const s = useSniperData(parkIdProp, onParkChange);
  const recentFinds = useRecentFinds(s.parkId);

  const INTRO_KEY = "wildatlas_sniper_intro_dismissed";
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    localStorage.setItem(INTRO_KEY, "1");
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
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

      {/* 2. Large stat row */}
      <SniperStats
        isPro={s.isPro}
        FREE_WATCH_LIMIT={s.FREE_WATCH_LIMIT}
        activeCount={s.activeCount}
        alertCount={s.alertCount}
        foundCount={s.foundCount}
        totalAvailDates={s.totalAvailDates}
        permitDefs={s.permitDefs}
        watches={s.watches}
        getAvailability={s.getAvailability}
        onUpgrade={() => s.setProModalOpen(true)}
      />

      {/* 3. Scanner status card */}
      <div className="px-5 mb-4">
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
            className="px-5 mb-4"
          >
            <div className="relative rounded-xl border border-primary/15 bg-primary/5 p-4">
              <button
                onClick={dismissIntro}
                className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss intro"
              >
                <X size={12} />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Radar size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-bold text-foreground leading-snug">How Permit Tracking Works</h3>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-snug font-medium">
                    <li>
                      <span className="font-bold text-foreground/80">1.</span> Tap a permit below to start tracking it
                    </li>
                    <li>
                      <span className="font-bold text-foreground/80">2.</span> Our scanner checks Recreation.gov every 2 minutes
                    </li>
                    <li>
                      <span className="font-bold text-foreground/80">3.</span> Get notified instantly when a cancellation opens up
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-5 space-y-3 pb-4">
        <p className="section-header">Permit Tracking</p>
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
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-secondary/30 bg-secondary/10 text-secondary py-3 text-[12px] font-semibold hover:bg-secondary/20 transition-colors"
          >
            <LogIn size={14} />
            Sign up to start tracking permits
          </motion.button>
        )}
      </div>

      {/* 4. Permit Activity dashboard */}
      <PermitActivity recentFinds={recentFinds} />

      {/* 5. Activity feed */}
      <PermitFeed recentFinds={recentFinds} />

      {/* 6. Park alerts */}
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
