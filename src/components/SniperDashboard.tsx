import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { LogIn, Radar, X, Clock, Plus, Radio, Mountain, ChevronDown } from "lucide-react";
const mochiChilling = "/mochi-neutral.png";
const mochiScratch = "/mochi-scratch.png";
const mochiCelebrating = "/mochi-celebrate.png";
import { Skeleton } from "@/components/ui/skeleton";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { SCANNER_STATE_LABELS } from "@/lib/scanner-status";

import ScrollableFooter from "@/components/ScrollableFooter";
import ScannerStatusCard from "@/components/ScannerStatusCard";
import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import PermitFeed from "@/components/PermitFeed";
import ParkAlerts from "@/components/ParkAlerts";
import AddPermitSearchModal from "@/components/AddPermitSearchModal";
import PermitCardSkeleton from "@/components/PermitCardSkeleton";
import PullToRefresh from "@/components/PullToRefresh";
import WelcomeModal from "@/components/WelcomeModal";
import CoachMark from "@/components/CoachMark";
import { getParkConfig } from "@/lib/parks";
import AlertStatusStrip from "@/components/alerts/AlertStatusStrip";
import MochiGlassCard from "@/components/alerts/MochiGlassCard";
import ScannerLine from "@/components/alerts/ScannerLine";
import TrackedPermitCard, { type TrackedPermit } from "@/components/alerts/TrackedPermitCard";
import AlertsSection from "@/components/alerts/AlertsSection";
import UpgradeNudgeCard from "@/components/alerts/UpgradeNudgeCard";
import { useProStatus } from "@/hooks/useProStatus";

const DEMO_TRACKED_PERMITS: TrackedPermit[] = [
  { id: "1", parkId: "yosemite", parkLabel: "Yosemite", permitName: "Half Dome", oddsPercent: 34, statusLabel: "Pre-season", statusColor: "#3D6BA0", dateLabel: "Jun 1 – Sep 30", daysLabel: "63 days" },
  { id: "2", parkId: "zion", parkLabel: "Zion", permitName: "The Narrows", oddsPercent: 52, statusLabel: "Open", statusColor: "#2E5D46", dateLabel: "Mar 1 – Nov 30", daysLabel: "12 days" },
  { id: "3", parkId: "grand-canyon", parkLabel: "Grand Canyon", permitName: "South Rim", oddsPercent: 18, statusLabel: "Pre-season", statusColor: "#3D6BA0", dateLabel: "May 1 – Oct 31", daysLabel: "32 days" },
  { id: "4", parkId: "grand-teton", parkLabel: "Grand Teton", permitName: "Lupine Meadows", oddsPercent: 41, statusLabel: "Open", statusColor: "#2E5D46", dateLabel: "Jun 1 – Sep 15", daysLabel: "63 days" },
  { id: "5", parkId: "glacier", parkLabel: "Glacier", permitName: "Highline Trail", oddsPercent: 27, statusLabel: "Pre-season", statusColor: "#3D6BA0", dateLabel: "Jul 1 – Sep 30", daysLabel: "93 days" },
  { id: "6", parkId: "rocky-mountain", parkLabel: "Rocky Mountain", permitName: "Trail Ridge Road", oddsPercent: 65, statusLabel: "Open", statusColor: "#2E5D46", dateLabel: "May 28 – Oct 15", daysLabel: "5 days" },
  { id: "7", parkId: "rainier", parkLabel: "Mt Rainier", permitName: "Camp Muir", oddsPercent: 22, statusLabel: "Pre-season", statusColor: "#3D6BA0", dateLabel: "Jun 15 – Sep 30", daysLabel: "77 days" },
  { id: "8", parkId: "arches", parkLabel: "Arches", permitName: "Delicate Arch", oddsPercent: 73, statusLabel: "Open", statusColor: "#2E5D46", dateLabel: "Apr 1 – Oct 31", daysLabel: "2 days" },
];

const SniperDashboard = () => {
  const navigate = useNavigate();
  const s = useSniperData();
  const scanner = useScannerStatus();
  const recentFinds = useRecentFinds();
  const { isPro } = useProStatus();

  const displayPermits = isPro ? DEMO_TRACKED_PERMITS : DEMO_TRACKED_PERMITS.slice(0, 1);
  const freeTrackedPark = !isPro ? displayPermits[0]?.parkLabel : undefined;

  const INTRO_KEY = DISMISSABLE_KEYS[0];
  const FIRST_SCAN_KEY = DISMISSABLE_KEYS[2];
  const hasActiveWatches = s.activeCount > 0;

  // Track which watch IDs were present on initial mount so we can distinguish
  // "initial load" cards (staggered) from "newly added" cards (single animate).
  const knownWatchIdsRef = useRef<Set<string>>(new Set());
  const initialMountRef = useRef(true);

  // After initial loading completes, snapshot current watch IDs as "known"
  useEffect(() => {
    if (s.initialLoading) return;
    if (initialMountRef.current) {
      knownWatchIdsRef.current = new Set(s.watches.map((w) => w.id));
      initialMountRef.current = false;
    }
  }, [s.initialLoading, s.watches]);
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));
  const [showFirstScan, setShowFirstScan] = useState(() => {
    if (localStorage.getItem(FIRST_SCAN_KEY)) return false;
    return true;
  });
  const [addModalOpen, setAddModalOpen] = useState(() => {
    if (localStorage.getItem("wildatlas_open_add_permit") === "true") {
      localStorage.removeItem("wildatlas_open_add_permit");
      return true;
    }
    return false;
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

  // Group tracked watches by park
  const trackedByPark = (() => {
    const groups = new Map<string, { parkId: string; parkName: string; watches: typeof s.watches }>();
    for (const w of s.watches) {
      if (!groups.has(w.park_id)) {
        groups.set(w.park_id, {
          parkId: w.park_id,
          parkName: getParkConfig(w.park_id).shortName,
          watches: [],
        });
      }
      groups.get(w.park_id)!.watches.push(w);
    }
    return Array.from(groups.values());
  })();

  const trackedParkCount = trackedByPark.length;
  const trackedParkIds = new Set(trackedByPark.map((g) => g.parkId));

  // Estimate scan count using same formula as Mochi tab (2-min interval)
  const SCAN_INTERVAL_MS = 2 * 60 * 1000;
  const earliest = s.watches.reduce<number | null>((min, w) => {
    if (!w.created_at || !w.is_active) return min;
    const t = new Date(w.created_at).getTime();
    return min === null ? t : Math.min(min, t);
  }, null);
  const estimatedScans = earliest !== null ? Math.max(0, Math.floor((Date.now() - earliest) / SCAN_INTERVAL_MS)) : 0;

  // Build permit def lookup for tracked permits
  const getPermitDef = (permitName: string, parkId: string) =>
    s.permitDefs.find((d) => d.name === permitName && d.park_id === parkId) ?? {
      name: permitName,
      description: null,
      season_start: null,
      season_end: null,
      total_finds: 0,
      park_id: parkId,
    };

  const trackedPermitsList = s.watches.map((w) => ({
    permit_name: w.permit_name,
    park_id: w.park_id,
  }));

  const handleAddPermit = async (permitName: string, parkId: string) => {
    await s.toggleWatch(permitName, parkId);
  };

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      scanner.refreshHeartbeat(),
      s.fetchAvailability(),
    ]);
  }, [scanner, s]);

  if (s.initialLoading) {
    return (
      <div className="flex flex-col h-full px-5 pt-4 gap-4 content-crossfade">
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
        <PermitCardSkeleton count={3} />
      </div>
    );
  }

  return (
    <>
    <PullToRefresh onRefresh={handlePullRefresh} className="flex flex-col h-full relative content-crossfade [background-color:var(--cream)]">
      {/* ── Sticky header bar ── */}
      <div
        className="sticky top-0 z-50 flex items-center justify-between px-[24px]"
        style={{
          height: 52,
          backgroundColor: 'rgba(245,245,240,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Shield logo */}
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 1L1 5V11C1 16.52 4.84 21.74 10 23C15.16 21.74 19 16.52 19 11V5L10 1Z" stroke="var(--forest)" strokeWidth="1.5" fill="none" />
            <path d="M7 12L10 8L13 12M10 8V16" stroke="var(--forest)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 500, color: 'var(--forest)' }}>
            WildAtlas
          </span>
        </div>
        <button
          className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, backgroundColor: 'var(--forest)' }}
          aria-label="Profile"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="5" r="2" stroke="white" strokeWidth="1.2" />
            <path d="M3 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between" style={{ padding: '20px 24px 0', marginBottom: 6 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {isPro ? "Your Permits" : "Your Permit"}
        </h1>
        {isPro && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--forest-m)', minHeight: 44 }}
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      {/* ── Status Strip ── */}
      <AlertStatusStrip />

      {/* ── Mochi Glass Card ── */}
      <MochiGlassCard chips={isPro ? undefined : [displayPermits[0]?.permitName ?? "Half Dome"]} />

      {/* ── Scanner Line ── */}
      <ScannerLine scannerState={scanner.scannerState} lastScanAt={scanner.lastSuccessfulScanAt} getTimeAgo={scanner.getTimeAgo} isPro={isPro} />

      {/* ── Tracked Section Header ── */}
      <div className="flex items-baseline justify-between" style={{ margin: "18px 24px 10px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: "var(--ink)" }}>
          Tracked
        </h2>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "var(--dim)" }}>
          {isPro ? "Sorted by opening date" : "1 of 1 on Free"}
        </span>
      </div>

      {/* ── Tracked Permit Cards ── */}
      {displayPermits.map((permit) => (
        <TrackedPermitCard key={permit.id} permit={permit} />
      ))}

      {/* ── Upgrade Nudge (Free only) ── */}
      {!isPro && <UpgradeNudgeCard />}

      {/* ── Alerts Section ── */}
      <AlertsSection trackedPark={freeTrackedPark} />

      <AnimatePresence>
        {s.watches.length > 0 && (
          <motion.div
            ref={statusCardRef}
            key="scanner-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="px-5 pt-5 pb-3"
          >
            <ScannerStatusCard
              scannerState={scanner.scannerState}
              activeCount={s.activeCount}
              trackedParkCount={trackedParkCount}
              lastSuccessfulScanAt={scanner.lastSuccessfulScanAt}
              getTimeAgo={scanner.getTimeAgo}
              onAddPermit={() => setAddModalOpen(true)}
              estimatedScans={estimatedScans}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="rounded-[18px] bg-status-quiet/10 border border-status-quiet/20 p-5">
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
                  We run frequent automated checks on Recreation.gov around the clock.
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works intro */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="px-5 mb-6"
          >
            <div className="relative rounded-[18px] border border-border/70 bg-muted/30 p-4">
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
                    <li><span className="font-bold text-foreground/60">1.</span> Tap "Add Permit" to start tracking</li>
                    <li><span className="font-bold text-foreground/60">2.</span> Scanner runs frequent checks</li>
                    <li><span className="font-bold text-foreground/60">3.</span> Get notified on cancellations</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tracked Permits ── */}
      <div className="px-5 pt-3 space-y-4 pb-6">
        {/* Empty state — only when truly no watches AND no pending onboarding permit */}
        <AnimatePresence mode="wait">
          {s.watches.length === 0 && s.user && (
            s.initialLoading ? (
              <PermitCardSkeleton key="loading" count={1} />
            ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
              className="rounded-[20px] border border-border/60 bg-card px-6 py-10 flex flex-col items-center justify-center gap-4"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div style={{ width: "min(140px, 30vw)" }}>
                <img
                  src={mochiScratch}
                  alt="Mochi mascot scratching head"
                  className="w-full h-auto object-contain max-w-full"
                  loading="lazy"
                />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-[15px] font-heading font-bold text-foreground">No active watches yet</p>
                <p className="text-[12px] text-muted-foreground max-w-[260px]">
                  Add a permit watch and we'll alert you the moment it opens up.
                </p>
              </div>
              <div className="relative inline-flex">
                <CoachMark loading={s.initialLoading} activeCount={s.activeCount} />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  onClick={() => setAddModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-secondary text-secondary-foreground font-bold text-[13px] hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Plus size={14} />
                  Watch your first permit →
                </motion.button>
              </div>
            </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Not signed in */}
        {!s.user && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 text-secondary py-3.5 text-[13px] font-bold hover:bg-secondary/20 transition-all"
          >
            <LogIn size={14} />
            Sign up to start tracking permits
          </motion.button>
        )}

        {/* Tracked permits grouped by park */}
        {trackedByPark.length > 0 && (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-[17px] font-semibold text-foreground font-body">Tracked permits</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-1 text-[14px] font-medium text-primary hover:text-primary/80 transition-all duration-150 min-w-[44px] min-h-[44px] justify-center -mr-2"
              >
                <Plus size={13} />
                Add
              </motion.button>
            </div>

            {trackedByPark.map((group) => (
              <div key={group.parkId} className="space-y-4">
                {trackedByPark.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Mountain size={12} className="text-secondary" />
                    <span className="text-[13px] font-medium text-secondary font-body">{group.parkName}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}

                {group.watches.map((watch, i) => {
                  const permitDef = getPermitDef(watch.permit_name, watch.park_id);
                  const isInitialCard = knownWatchIdsRef.current.has(watch.id);
                  const isNewCard = !initialMountRef.current && !knownWatchIdsRef.current.has(watch.id);
                  // Stagger on initial mount (capped at 150ms), single animate for new cards
                  const delay = isInitialCard ? Math.min(i, 3) * 0.05 : 0;
                  const shouldAnimate = isInitialCard || isNewCard;

                  // Mark newly added cards as known so they don't re-animate
                  if (isNewCard) knownWatchIdsRef.current.add(watch.id);

                  return (
                    <motion.div
                      key={watch.id}
                      id={`permit-card-${watch.permit_name}`}
                      initial={shouldAnimate ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.15,
                        ease: "easeOut",
                      }}
                    >
                      {(recentFinds.lastFindByPermit[watch.permit_name] ?? null) && (
                        <div className="flex justify-center mb-3">
                          <div style={{ width: "min(160px, 32vw)" }}>
                            <img
                              src={mochiCelebrating}
                              alt="Mochi celebrating"
                              className="w-full h-auto object-contain"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}
                      <WatchCard
                        permit={permitDef}
                        parkId={watch.park_id}
                        watch={watch}
                        availability={s.getAvailability(watch.permit_name, watch.park_id)}
                        lastFind={recentFinds.lastFindByPermit[watch.permit_name] ?? null}
                        index={i}
                        isLoading={s.loadingId === watch.permit_name}
                        hasPhone={s.hasPhone}
                        isPro={s.isPro}
                        userId={s.user?.id ?? ""}
                        showPhoneInput={s.showPhoneInput}
                        getTimeAgo={s.getTimeAgo}
                        scannerStale={scanner.isStale}
                        lastChecked={s.lastChecked}
                        scanPulse={s.scanPulse}
                        scannerState={scanner.scannerState}
                        onToggleWatch={s.toggleWatch}
                        onDeleteWatch={s.deleteWatch}
                        onToggleNotify={s.toggleNotify}
                        onTogglePhoneInput={s.setShowPhoneInput}
                        onPhoneSaved={s.handlePhoneSaved}
                        onUpgrade={() => s.setProModalOpen(true)}
                        onRefresh={s.fetchAvailability}
                      />
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </>
        )}

      </div>

      {/* Recent Finds — filtered to tracked parks */}
      <div id="permit-feed-section" className="mt-6">
        <PermitFeed recentFinds={recentFinds} trackedParkIds={trackedParkIds} hasTrackedPermits={s.watches.length > 0} />
      </div>

      {/* NPS Alerts */}
      <div className="border-t border-border/30 pt-6 mx-5">
        <ParkAlerts trackedParkIds={trackedParkIds} />
      </div>
      {/* Bottom safe-area padding to scroll past nav */}
      <div className="pb-28" />
    </PullToRefresh>

    {/* Modals — outside PullToRefresh to avoid gesture conflicts */}
    <AddPermitSearchModal
      open={addModalOpen}
      onOpenChange={setAddModalOpen}
      trackedPermits={trackedPermitsList}
      onAddPermit={handleAddPermit}
    />
    <PermitSuccessOverlay
      open={s.successOpen}
      onClose={() => s.setSuccessOpen(false)}
      permitName={s.foundPermit?.name}
      permitDate={s.foundPermit?.date}
      recgovPermitId={s.foundPermit?.recgovPermitId}
    />
    <ProModal open={s.proModalOpen} onOpenChange={s.setProModalOpen} />
    <WelcomeModal
      loading={s.initialLoading}
      hasTrackedPermits={s.watches.length > 0}
      onSetUpAlert={() => setAddModalOpen(true)}
    />
  </>
  );
};

export default SniperDashboard;
