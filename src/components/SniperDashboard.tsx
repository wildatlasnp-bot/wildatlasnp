import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { LogIn, Radar, X, Clock, Plus, Radio, Mountain, ChevronDown, Trash2, MessageSquare, ExternalLink } from "lucide-react";
const mochiChilling = "/mochi-neutral.png";
const mochiScratch = "/mochi-scratch.png";
import { Skeleton } from "@/components/ui/skeleton";
import { DISMISSABLE_KEYS } from "@/lib/dismissable-tips";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { SCANNER_STATE_LABELS } from "@/lib/scanner-status";

import ScrollableFooter from "@/components/ScrollableFooter";
import ScannerStatusCard from "@/components/ScannerStatusCard";
import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import ParkAlerts from "@/components/ParkAlerts";
import AddPermitSearchModal from "@/components/AddPermitSearchModal";
import PermitCardSkeleton from "@/components/PermitCardSkeleton";
import PullToRefresh from "@/components/PullToRefresh";
import WelcomeModal from "@/components/WelcomeModal";
import CoachMark from "@/components/CoachMark";
import { getParkConfig } from "@/lib/parks";
import MochiGlassCard from "@/components/alerts/MochiGlassCard";
import RecentCatchesFeed from "@/components/RecentCatchesFeed";
import { WatchActivatedToast } from "@/components/WatchActivatedToast";


import { useProStatus } from "@/hooks/useProStatus";
import { useScrollFadeHeader } from "@/hooks/useScrollFadeHeader";

// Hero images now sourced from getParkConfig().heroImage

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";



const SniperDashboard = () => {
  const navigate = useNavigate();
  const s = useSniperData();
  const scanner = useScannerStatus();
  const { isPro } = useProStatus();
  const headerFadeRef = useScrollFadeHeader();

  const INTRO_KEY = DISMISSABLE_KEYS[0];
  const FIRST_SCAN_KEY = DISMISSABLE_KEYS[2];
  const hasActiveWatches = s.activeCount > 0;

  const knownWatchIdsRef = useRef<Set<string>>(new Set());
  const initialMountRef = useRef(true);

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

  // Group tracked watches by park
  const trackedByPark = (() => {
    const groups = new Map<string, { parkId: string; parkName: string; watches: typeof s.watches }>();
    for (const w of s.watches) {
      if (!w.is_active) continue;
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

  const SCAN_INTERVAL_MS = 2 * 60 * 1000;
  const earliest = s.watches.reduce<number | null>((min, w) => {
    if (!w.created_at || !w.is_active) return min;
    const t = new Date(w.created_at).getTime();
    return min === null ? t : Math.min(min, t);
  }, null);
  const estimatedScans = earliest !== null ? Math.max(0, Math.floor((Date.now() - earliest) / SCAN_INTERVAL_MS)) : 0;

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

  const [watchActivated, setWatchActivated] = useState(false);

  const handleAddPermit = async (permitName: string, parkId: string) => {
    await s.toggleWatch(permitName, parkId, { suppressSuccessToast: true });
    // Flag activation, then dismiss modal after a beat
    setWatchActivated(true);
    setTimeout(() => setAddModalOpen(false), 50);
  };

  // Show toast 150ms after modal dismiss starts
  const [showWatchToast, setShowWatchToast] = useState(false);
  useEffect(() => {
    if (watchActivated && !addModalOpen) {
      const t = setTimeout(() => setShowWatchToast(true), 150);
      return () => clearTimeout(t);
    }
  }, [watchActivated, addModalOpen]);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      scanner.refreshHeartbeat(),
      s.fetchAvailability(),
    ]);
  }, [scanner, s]);

  // Expanded state for permit cards
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  if (s.initialLoading) {
    return (
      <div className="flex flex-col h-full px-5 pt-4 gap-4 content-crossfade" style={{ backgroundColor: "#F0EDEA" }}>
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
    <PullToRefresh onRefresh={handlePullRefresh} className="flex flex-col h-full relative content-crossfade [background-color:#F0EDEA]">
      {/* ── Dark Header Section — atmospheric, layered ── */}
      <div
        style={{
          position: "relative",
          background:
            "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(201,169,110,0.10) 0%, rgba(201,169,110,0.03) 35%, transparent 65%)," +
            "radial-gradient(ellipse 90% 60% at 100% 0%, rgba(76,175,125,0.08) 0%, transparent 55%)," +
            "linear-gradient(180deg, #0E2E1E 0%, #08210F 55%, #051A0C 100%)",
          overflow: "hidden",
        }}
      >
        {/* Topographic noise overlay — subtle film grain feel */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.93  0 0 0 0 0.88  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            opacity: 0.55,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
        <div ref={headerFadeRef} style={{ position: "relative", padding: "36px 20px 0" }}>
          {/* Editorial eyebrow */}
          <div
            style={{
              fontFamily: DM_SANS,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(201,169,110,0.85)",
              marginBottom: 14,
              opacity: "var(--header-opacity, 1)" as any,
              willChange: "opacity",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ display: "inline-block", width: 18, height: 1, background: "rgba(201,169,110,0.55)" }} />
            Field Journal
          </div>
          <h1
            style={{
              fontFamily: CORMORANT,
              fontSize: 60,
              fontWeight: 200,
              color: "#F4F1EC",
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              opacity: "var(--header-opacity, 1)" as any,
              willChange: "opacity",
              textShadow: "0 1px 24px rgba(0,0,0,0.25)",
            }}
          >
            My Parks
          </h1>
          {/* Status summary */}
          <div className="flex items-center gap-2" style={{ marginTop: 10, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>
             <span
               style={{
                 fontFamily: CORMORANT,
                 fontSize: 17,
                 fontStyle: "italic",
                 fontWeight: 400,
                 color: "rgba(244,241,236,0.78)",
                 letterSpacing: "0.005em",
               }}
             >
              {s.watches.length === 0
                 ? "Poko's standing by."
                 : s.foundCount > 0
                  ? `Poko's watching · ${s.foundCount} found today`
                  : s.watches.length > 0
                    ? `Poko's watching · ${s.watches.length} alert${s.watches.length !== 1 ? "s" : ""}`
                    : "Poko's watching · Quiet so far"}
            </span>
            <AnimatePresence>
              {s.watches.length > 0 && s.backgroundRefreshing && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    fontStyle: "italic",
                  }}
                >
                  Updating…
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div style={{ marginBottom: 26 }} />

        {/* ── Mochi Insight Card (borderless) ── */}
        {s.watches.length > 0 && (
          <div style={{ position: "relative", marginBottom: 0 }}>
          <MochiGlassCard
            permitName={s.watches[0]?.permit_name}
            parkName={s.watches[0]?.park_id}
            watchCount={s.watches.length}
            hasFound={s.foundCount > 0}
            darkMode
          />
          </div>
         )}

        {/* ── Tracked Permits Section (inside dark zone) ── */}
        <div style={{ position: "relative", padding: "0 0 18px" }}>
        {/* Section ornament — centered editorial divider */}
        {s.watches.length > 0 && (
          <div style={{ margin: "44px 24px 22px" }}>
            {/* Row 1: hairline · diamond · WATCHING · count · diamond · hairline */}
            <div
              className="flex items-center"
              style={{ gap: 14 }}
              aria-hidden={false}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.32) 100%)",
                }}
              />
              <span
                style={{
                  width: 4,
                  height: 4,
                  background: "rgba(201,169,110,0.85)",
                  transform: "rotate(45deg)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.32em",
                  color: "rgba(244,241,236,0.78)",
                  whiteSpace: "nowrap",
                }}
              >
                Watching
                {isPro && (
                  <span style={{ color: "rgba(244,241,236,0.40)", marginLeft: 10, letterSpacing: "0.22em" }}>
                    · {s.activeCount} of 3
                  </span>
                )}
              </span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  background: "rgba(201,169,110,0.85)",
                  transform: "rotate(45deg)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background:
                    "linear-gradient(90deg, rgba(201,169,110,0.32) 0%, transparent 100%)",
                }}
              />
            </div>

            {/* Row 2: quiet utility action, centered below */}
            {isPro === undefined ? null : !isPro ? (
              <div className="flex justify-center" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => s.setProModalOpen(true)}
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(201,169,110,0.92)",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: "6px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Add another park
                  <svg width="7" height="10" viewBox="0 0 7 10" fill="none">
                    <path d="M1 1L5 5L1 9" stroke="rgba(201,169,110,0.92)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Empty state — inside dark zone */}
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
                className="flex flex-col items-center justify-center flex-1"
                style={{ padding: "40px 24px 48px", minHeight: 320 }}
              >
                <div style={{ height: 140 }}>
                  <img
                    src="/mochi-wave.png"
                    alt="Poko mascot waving hello"
                    style={{ width: "auto", height: 140, objectFit: "contain" }}
                  />
                </div>
                <p style={{
                  fontFamily: CORMORANT,
                  fontSize: 30,
                  fontWeight: 400,
                  color: "#F0EDEA",
                  textAlign: "center",
                  marginTop: 16,
                }}>
                  Nothing to watch yet.
                </p>
                <p style={{
                  fontFamily: DM_SANS,
                  fontSize: 14,
                  color: "#A8A89A",
                  textAlign: "center",
                  maxWidth: 260,
                  marginTop: 8,
                  lineHeight: 1.6,
                  textWrap: "balance",
                }}>
                  Add a permit and Poko starts scanning Recreation.gov every 5 minutes.
                </p>
                <button
                  onClick={() => setAddModalOpen(true)}
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#F0EDEA",
                    background: "#2F6F4E",
                    height: 48,
                    padding: "0 28px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    marginTop: 20,
                  }}
                >
                  Watch your first permit
                </button>
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
            style={{
              width: "calc(100% - 40px)",
              margin: "0 20px",
              fontFamily: DM_SANS,
              fontSize: 13,
              fontWeight: 600,
              color: "#2F6F4E",
              background: "rgba(47,111,78,0.08)",
              border: "1px solid rgba(47,111,78,0.2)",
              borderRadius: 12,
              padding: "14px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <LogIn size={14} />
            Sign up to start tracking permits
          </motion.button>
        )}

        {/* ── Permit Photo Cards ── */}
        {trackedByPark.map((group) =>
          group.watches.map((watch, i) => {
            const permitDef = getPermitDef(watch.permit_name, watch.park_id);
            const parkConfig = getParkConfig(watch.park_id);
            const isExpanded = expandedCardId === watch.id;

            const seasonLabel =
              permitDef.season_start && permitDef.season_end
                ? `${formatSeasonDate(permitDef.season_start)} – ${formatSeasonDate(permitDef.season_end)}`
                : null;

            const daysUntilSeason = permitDef.season_start
              ? getDaysUntil(permitDef.season_start)
              : null;

            return (
              <motion.div
                key={watch.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i, 2) * 0.08,
                  duration: 0.38,
                  ease: [0.22, 0.03, 0.26, 1.0],
                }}
              >
                <PermitPhotoCard
                  watch={watch}
                  permitDef={permitDef}
                  parkConfig={parkConfig}
                  seasonLabel={seasonLabel}
                  daysUntilSeason={daysUntilSeason}
                  isExpanded={isExpanded}
                  onToggleExpand={() =>
                    setExpandedCardId(isExpanded ? null : watch.id)
                  }
                  onDelete={() => s.deleteWatch(watch.id)}
                  onToggleNotify={() => s.toggleNotify(watch.id)}
                  smsEnabled={watch.notify_sms}
                  isPro={s.isPro}
                  lastScannedAt={scanner.lastSuccessfulScanAt}
                />
              </motion.div>
            );
          })
        )}


      </div>{/* close tracked permits */}
      </div>{/* close dark hero zone */}

      {/* Dark-to-cream gradient transition */}
      <div style={{ height: 40, background: "linear-gradient(to bottom, #1A2F1E, #F0EDEA)" }} />

      {/* ── Recent Catches Feed ── */}
      <div style={{ backgroundColor: "#F2F1ED", position: "relative" }}>
      <RecentCatchesFeed />

      {/* ── Park Alerts — Field Dispatch (full-bleed hero) ── */}
      <div style={{ background: "#F2F1ED", marginTop: 20 }}>
        <ParkAlerts trackedParkIds={trackedParkIds} />
      </div>

      {/* Inline "Watch a permit" button */}
      {s.user && (
        <div style={{ padding: '12px 16px 16px' }}>
          <button
            onClick={() => {
              if (!isPro && s.activeCount >= 1) {
                s.setProModalOpen(true);
              } else {
                setAddModalOpen(true);
              }
            }}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 12,
              background: '#2F6F4E',
              border: 'none',
              color: '#F0EDEA',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            <span style={{ color: '#C9A96E', fontSize: 16, marginRight: 6 }}>+</span>
            Watch a permit
          </button>
        </div>
      )}

      </div>{/* close inset shadow wrapper */}

      {/* Bottom safe-area padding */}
      <div style={{ height: 80 }} />
    </PullToRefresh>

    {/* Modals */}
    <AddPermitSearchModal
      open={addModalOpen}
      onOpenChange={(open) => {
        setAddModalOpen(open);
        // If modal closed without activation flag, it's a cancellation
        if (!open && !watchActivated) {
          setWatchActivated(false);
        }
      }}
      trackedPermits={trackedPermitsList}
      onAddPermit={handleAddPermit}
    />
    <WatchActivatedToast
      show={showWatchToast}
      onDone={() => {
        setShowWatchToast(false);
        setWatchActivated(false);
      }}
    />
    <PermitSuccessOverlay
      open={s.successOpen}
      onClose={() => s.setSuccessOpen(false)}
      permitName={s.foundPermit?.name}
      permitDate={s.foundPermit?.date}
      recgovPermitId={s.foundPermit?.recgovPermitId}
    />
    <ProModal open={s.proModalOpen} onOpenChange={s.setProModalOpen} source="watch_limit" />
    <WelcomeModal
      loading={s.initialLoading}
      hasTrackedPermits={s.watches.length > 0}
      onSetUpAlert={() => setAddModalOpen(true)}
    />
  </>
  );
};

/* ── Permit Photo Card ── */

interface PermitPhotoCardProps {
  watch: any;
  permitDef: any;
  parkConfig: any;
  seasonLabel: string | null;
  daysUntilSeason: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onToggleNotify: () => void;
  smsEnabled: boolean;
  isPro: boolean;
  lastScannedAt: string | null;
}

const PermitPhotoCard = ({
  watch,
  permitDef,
  parkConfig,
  seasonLabel,
  daysUntilSeason,
  isExpanded,
  onToggleExpand,
  onDelete,
  onToggleNotify,
  smsEnabled,
  isPro,
  lastScannedAt,
}: PermitPhotoCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tick, setTick] = useState(0);
  

  const isFound = watch.status === "found" || watch.status === "available";

  // Relative time tick every 30s for "Scanned X ago"
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const scannedAgoText = (() => {
    if (!lastScannedAt) return "Starting scan...";
    const seconds = Math.floor((Date.now() - new Date(lastScannedAt).getTime()) / 1000);
    if (seconds < 60) return `Scanned ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Scanned ${minutes} min ago`;
  })();

  const isStale = !lastScannedAt || (Date.now() - new Date(lastScannedAt).getTime()) > 5 * 60 * 1000;


  const { statusColor, statusLabel, statusPulse } = (() => {
    if (isFound) return { statusColor: "#2F6F4E", statusLabel: "Found", statusPulse: false };
    if (!watch.is_active) return { statusColor: "#9CA3AF", statusLabel: "Paused", statusPulse: false };
    if (daysUntilSeason !== null && daysUntilSeason > 0) return { statusColor: "#BA7517", statusLabel: "Pre-season", statusPulse: false };
    return { statusColor: "#2F6F4E", statusLabel: "Searching", statusPulse: true };
  })();

  return (
    <>
      <div
        style={{
          position: "relative",
          margin: "0 16px 0",
          borderRadius: 14,
          overflow: "hidden",
          cursor: "pointer",
          border: "1px solid rgba(201,169,110,0.22)",
          // Layered elevation: ambient + key + contact + inner highlights
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.10)",
            "inset 0 -1px 0 rgba(0,0,0,0.30)",
            "0 36px 56px -28px rgba(0,0,0,0.60)",
            "0 16px 28px -16px rgba(0,0,0,0.45)",
            "0 2px 4px rgba(0,0,0,0.35)",
          ].join(", "),
          willChange: "transform",
        }}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
      >
        <div>
        {/* Photo zone */}
        <div style={{ height: 240, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #1C2E22 0%, #2F4A38 50%, #1A2820 100%)" }}>
          {parkConfig.heroImage ? (
            <img
              src={parkConfig.heroImage}
              alt={permitDef.name}
              loading="lazy"
              width={960}
              height={640}
              style={{
                width: "100%",
                height: "240px",
                objectFit: "cover" as const,
                position: "absolute",
                top: 0,
                left: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
                background: "linear-gradient(135deg, #1C3829 0%, #2F6F4E 50%, #1a2a1a 100%)",
              }}
            />
          )}
          {/* Color-matched duotone tint — pulls photo into the dark green palette */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(8,33,15,0.28) 0%, rgba(8,33,15,0.10) 35%, rgba(8,33,15,0.18) 100%)",
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
          {/* Subtle green wash to harmonize warm photos with hero */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(28,56,35,0.14)",
              mixBlendMode: "color",
              pointerEvents: "none",
            }}
          />
          {/* Gradient scrim */}
          <div className="park-photo-scrim" />
          {/* Top edge — feathered dissolve into hero green */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 56,
              background:
                "linear-gradient(180deg, #08210F 0%, rgba(8,33,15,0.85) 30%, rgba(8,33,15,0.45) 65%, transparent 100%)",
              filter: "blur(0.5px)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
          {/* Cinematic top vignette for badge legibility (above feather) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 90,
              background: "linear-gradient(180deg, rgba(8,21,15,0.55) 0%, rgba(8,21,15,0.20) 50%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Cinematic bottom gradient for title */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 130,
              background: "linear-gradient(180deg, transparent 0%, rgba(8,21,15,0.55) 60%, rgba(8,21,15,0.85) 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Liveness pill — scan timestamp */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(244,241,236,0.92)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              borderRadius: 999,
              padding: "5px 11px 5px 10px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04) inset",
            }}
          >
            <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
              {!isStale && (
                <>
                  <span style={{
                    position: "absolute", top: 0, left: 0, width: 8, height: 8,
                    borderRadius: "50%", border: "1.5px solid #2F6F4E",
                    animation: "scan-ring-1 1.8s ease-out infinite",
                  }} />
                  <span style={{
                    position: "absolute", top: 0, left: 0, width: 8, height: 8,
                    borderRadius: "50%", border: "1.5px solid #2F6F4E",
                    animation: "scan-ring-2 1.8s ease-out 0.4s infinite",
                  }} />
                </>
              )}
              <span style={{
                position: "absolute", top: 0, left: 0,
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: isStale ? "#A8A89A" : "#2F6F4E",
              }} />
            </div>
             <span
               style={{
                 fontFamily: DM_SANS,
                 fontSize: 11,
                 fontWeight: 500,
                 letterSpacing: "0.04em",
                 color: "#1A2820",
                 whiteSpace: "nowrap",
               }}
             >
              {scannedAgoText}
            </span>
          </div>
           {/* Park label — editorial gold-bordered chip */}
           <span
             style={{
               position: "absolute",
               top: 14,
               right: 14,
               fontFamily: DM_SANS,
               fontSize: 10,
               fontWeight: 600,
               letterSpacing: "0.24em",
               textTransform: "uppercase",
               color: "rgba(244,241,236,0.95)",
               background: "rgba(8,21,15,0.45)",
               backdropFilter: "blur(10px)",
               WebkitBackdropFilter: "blur(10px)",
               padding: "5px 10px",
               borderRadius: 4,
               border: "1px solid rgba(201,169,110,0.55)",
               boxShadow: "0 2px 8px rgba(0,0,0,0.20)",
              zIndex: 10,
             }}
           >
             {parkConfig.shortName.toUpperCase()}
           </span>
          {/* Permit name — bottom-left */}
          <span
            style={{
              position: "absolute",
              bottom: 22,
              left: 20,
              right: 20,
              zIndex: 10,
               fontFamily: CORMORANT,
              fontSize: 28,
              fontWeight: 300,
              color: "#F4F1EC",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
              textShadow: "0 2px 12px rgba(0, 0, 0, 0.45)",
              display: "block",
            }}
          >
            {permitDef.name}
          </span>
        </div>

        {/* Data strip — labeled expand affordance */}
        <div
          style={{
            background: "#E0DDD8",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            padding: "0 16px",
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontFamily: DM_SANS, fontSize: 13, fontWeight: 500, color: "#3D3D2E" }}>
            Alert settings
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            style={{
              color: "rgba(0,0,0,0.45)",
              transition: "transform 0.2s ease",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          />
        </div>
        {/* Book Now CTA for found state */}
        {isFound && permitDef.recgov_permit_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://www.recreation.gov/permits/${permitDef.recgov_permit_id}`, "_blank");
            }}
            style={{
              width: "100%",
              height: 44,
              background: "#2F6F4E",
              color: "#F0EDEA",
              fontFamily: DM_SANS,
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Book on Recreation.gov →
          </button>
        )}


        <div
          style={{
            maxHeight: isExpanded ? 400 : 0,
            overflow: "hidden",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
           <div
             style={{
                background: "rgba(240,237,234,0.96)",
                borderTop: "1px solid rgba(28,24,18,0.08)",
                borderRadius: "0 0 12px 12px",
                transition: "background-color 0.2s",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Zone 1 — Poko insight */}
              <div style={{ padding: "16px 16px 16px 16px" }}>
                <div
                  style={{
                    borderLeft: "3px solid #C9A96E",
                    paddingLeft: 16,
                    paddingBottom: 0,
                  }}
                >
                  <p
                    style={{
                      fontFamily: CORMORANT,
                      fontSize: 17,
                      fontStyle: "italic",
                      fontWeight: 400,
                      color: "#3D3D2E",
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    Permits drop most often mid-week — I'll alert you instantly.
                  </p>
                </div>
              </div>

              {/* Divider — inset 16px each side */}
              <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "0 16px", transition: "border-color 0.2s" }} />

              {/* Zone 2 — SMS toggle (full row is tap target) */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNotify();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleNotify();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 44,
                  padding: "16px 16px 0 16px",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: DM_SANS, fontSize: 14, fontWeight: 400, color: "#3D3D2E" }}>
                  SMS alerts
                </span>
                <div
                  style={{
                    width: 51,
                    height: 31,
                    borderRadius: 15.5,
                    background: smsEnabled ? "#2F6F4E" : "rgba(0,0,0,0.15)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                  aria-label={smsEnabled ? "Disable SMS" : "Enable SMS"}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: smsEnabled ? 22 : 2,
                      width: 27,
                      height: 27,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.20)",
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
              </div>

             {/* Divider */}
             <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "0 16px" }} />

             {/* Zone 3 — Remove action */}
              <div style={{ padding: "16px 16px 16px 16px", margin: "0" }}>
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   setConfirmDelete(true);
                 }}
                 style={{
                   width: "100%",
                   height: 40,
                   borderRadius: 8,
                   border: "1.5px solid rgba(226,75,74,0.5)",
                   background: "transparent",
                   color: "#E24B4A",
                   fontFamily: DM_SANS,
                   fontSize: 14,
                   fontWeight: 500,
                   cursor: "pointer",
                   display: "flex",
                   alignItems: "center",
                   justifyContent: "center",
                   gap: 6,
                 }}
               >
                 <Trash2 size={14} />
                 Remove this alert
               </button>
             </div>
           </div>
        </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[999] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
            style={{
              background: "#F0EDEA",
              borderRadius: "16px 16px 0 0",
              padding: "24px 24px 80px",
              animation: "slide-up-sheet 0.25s ease-out",
            }}
          >
            <h3
              style={{
                fontFamily: CORMORANT,
                fontSize: 22,
                fontWeight: 400,
                color: "#1A2F1E",
                marginBottom: 6,
              }}
            >
              Remove {permitDef.name}?
            </h3>
            <p
              style={{
                fontFamily: DM_SANS,
                fontSize: 14,
                color: "rgba(26,47,30,0.70)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              You'll stop receiving alerts for this permit. You can always add it back later.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
                style={{
                  width: "100%",
                  fontFamily: DM_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#F0EDEA",
                  background: "#B85450",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  width: "100%",
                  fontFamily: DM_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1A2F1E",
                  background: "transparent",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Helpers ── */

function formatSeasonDate(dateStr: string): string {
  const shortMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const match = dateStr.match(/^(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const monthIdx = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    return `${shortMonths[monthIdx]} ${day}`;
  }
  return dateStr;
}

function getDaysUntil(seasonStart: string): number | null {
  const match = seasonStart.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const now = new Date();
  const target = new Date(now.getFullYear(), parseInt(match[1], 10) - 1, parseInt(match[2], 10));
  if (target.getTime() < now.getTime()) {
    target.setFullYear(target.getFullYear() + 1);
  }
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default SniperDashboard;
