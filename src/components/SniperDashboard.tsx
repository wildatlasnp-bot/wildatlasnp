import { useState, useCallback, useEffect, useRef } from "react";
import { LogIn, Radar, X, Clock, Zap, Plus, Radio, Mountain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { SCANNER_STATE_LABELS } from "@/lib/scanner-status";
import SniperHeader from "@/components/SniperHeader";

import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import PermitFeed from "@/components/PermitFeed";
import ParkAlerts from "@/components/ParkAlerts";
import { getParkConfig } from "@/lib/parks";

const SniperDashboard = () => {
  const navigate = useNavigate();
  const s = useSniperData();
  const scanner = useScannerStatus();
  const recentFinds = useRecentFinds(); // all parks

  const INTRO_KEY = DISMISSABLE_KEYS[0];
  const FIRST_SCAN_KEY = DISMISSABLE_KEYS[2];
  const hasActiveWatches = s.activeCount > 0;
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));
  const [showFirstScan, setShowFirstScan] = useState(() => {
    if (localStorage.getItem(FIRST_SCAN_KEY)) return false;
    return true;
  });
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    localStorage.setItem(INTRO_KEY, "1");
  }, [INTRO_KEY]);

  useEffect(() => {
    if (hasActiveWatches && showIntro) dismissIntro();
  }, [hasActiveWatches, showIntro, dismissIntro]);

  useEffect(() => {
    if (showFirstScan && s.lastChecked) {
      setShowFirstScan(false);
      localStorage.setItem(FIRST_SCAN_KEY, "1");
    }
  }, [showFirstScan, s.lastChecked]);

  // Sticky collapsed status bar
  const statusCardRef = useRef<HTMLDivElement>(null);
  const [statusCollapsed, setStatusCollapsed] = useState(false);

  useEffect(() => {
    const cardEl = statusCardRef.current;
    if (!cardEl) return;
    const handleScroll = () => {
      const rect = cardEl.getBoundingClientRect();
      setStatusCollapsed(rect.bottom < 0);
    };
    const listeners: EventTarget[] = [window];
    let el = cardEl.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") listeners.push(el);
      el = el.parentElement;
    }
    listeners.forEach((t) => t.addEventListener("scroll", handleScroll, { passive: true }));
    return () => listeners.forEach((t) => t.removeEventListener("scroll", handleScroll));
  }, []);

  const isActive = scanner.scannerState === "active";
  const isDelayed = scanner.scannerState === "delayed";
  const stickyLabel = SCANNER_STATE_LABELS[scanner.scannerState];
  const stickyDot = isDelayed ? "bg-status-busy" : isActive ? "bg-status-quiet" : "bg-muted-foreground";
  const stickyText = isDelayed ? "text-status-busy" : isActive ? "text-status-quiet" : "text-muted-foreground";

  if (s.initialLoading) {
    return (
      <div className="flex flex-col h-full px-5 pt-4 gap-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <Skeleton className="h-3 w-24 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-28 rounded" />
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto relative" data-tab-scroll>
      {/* Sticky collapsed status bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 max-w-lg mx-auto transition-all duration-200 ${
          statusCollapsed
            ? "px-5 py-2 bg-background/90 backdrop-blur-md border-b border-border/40 opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        }`}
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
            {(() => {
              const trackedPermits = s.watches.filter(w => w.is_active).map(w => w.permit_name);
              const userLastFound = trackedPermits.reduce<string | null>((best, p) => {
                const f = recentFinds.lastFindByPermit[p];
                return f && (!best || f > best) ? f : best;
              }, null);
              return userLastFound ? (
                <span className="flex items-center gap-1 text-[10px] text-status-found font-semibold">
                  <Zap size={8} />
                  {s.getTimeAgo(userLastFound)}
                </span>
              ) : null;
            })()}
          </div>
        </div>
      </div>

      {/* Header with refresh */}
      <SniperHeader
        activeCount={s.activeCount}
        scannerState={scanner.scannerState}
        refreshing={s.refreshing}
        onRefresh={s.fetchAvailability}
      />

      {/* Status card ref for sticky bar scroll detection */}
      <div ref={statusCardRef} />

      {/* First-session expectations card */}
      <AnimatePresence>
        {showFirstScan && hasActiveWatches && !s.lastChecked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="px-5 mb-6"
          >
            <div className="rounded-xl bg-status-quiet/10 border border-status-quiet/20 p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-status-quiet/30 animate-ping" style={{ animationDuration: "2s" }} />
                  <Radio size={14} className="relative text-status-quiet" />
                </span>
                <h3 className="text-[14px] font-heading font-bold text-foreground leading-snug">
                  Scanner is active — here's what to expect
                </h3>
              </div>
              <ul className="space-y-2.5 text-[12px] text-muted-foreground leading-relaxed font-body">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-quiet mt-[5px] shrink-0" />
                  We check Recreation.gov every 2 minutes around the clock.
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-quiet mt-[5px] shrink-0" />
                  Most permits are found within a few days of tracking.
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-quiet mt-[5px] shrink-0" />
                  You'll get a text the instant one opens — have Recreation.gov ready to book.
                </li>
              </ul>
              <button
                onClick={() => {
                  const feedEl = document.getElementById("permit-feed-section");
                  feedEl?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="mt-4 text-[12px] font-semibold text-status-quiet hover:text-status-quiet/80 transition-colors font-body"
              >
                See recent permit openings ↓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Permit Tracking — grouped by park */}
      <div className="px-5 space-y-6 pb-7">
        {s.parkPermitGroups.length > 0 && (
          <p className="section-header">Permit Tracking</p>
        )}

        {!s.parkPermitGroups.length && (
          <div className="rounded-xl border-2 border-dashed border-status-quiet/40 bg-status-quiet/5 px-5 py-8 flex flex-col items-center gap-3">
            <Plus size={20} className="text-status-quiet" />
            <p className="text-[13px] font-bold text-foreground/70">No permits available</p>
          </div>
        )}

        {s.parkPermitGroups.map((group) => (
          <div key={group.parkId} className="space-y-4">
            {/* Park group header */}
            <div className="flex items-center gap-2">
              <Mountain size={12} className="text-secondary" />
              <span className="text-[12px] font-bold text-secondary uppercase tracking-wider">{group.parkName}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {group.permits.map((permit, i) => (
              <div key={`${group.parkId}-${permit.name}`} id={`permit-card-${permit.name}`}>
                <WatchCard
                  permit={permit}
                  parkId={group.parkId}
                  watch={s.getWatchState(permit.name, group.parkId)}
                  availability={s.getAvailability(permit.name, group.parkId)}
                  lastFind={recentFinds.lastFindByPermit[permit.name] ?? null}
                  index={i}
                  isLoading={s.loadingId === permit.name}
                  hasPhone={s.hasPhone}
                  isPro={s.isPro}
                  userId={s.user?.id ?? ""}
                  showPhoneInput={s.showPhoneInput}
                  getTimeAgo={s.getTimeAgo}
                  scannerStale={scanner.isStale}
                  onToggleWatch={s.toggleWatch}
                  onDeleteWatch={s.deleteWatch}
                  onToggleNotify={s.toggleNotify}
                  onTogglePhoneInput={s.setShowPhoneInput}
                  onPhoneSaved={s.handlePhoneSaved}
                  onUpgrade={() => s.setProModalOpen(true)}
                  onRefresh={s.fetchAvailability}
                />
              </div>
            ))}
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

      {/* Recent Finds */}
      <div id="permit-feed-section" className="mb-2">
        <PermitFeed recentFinds={recentFinds} />
      </div>

      {/* NPS Alerts — all parks */}
      <ParkAlerts />

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
