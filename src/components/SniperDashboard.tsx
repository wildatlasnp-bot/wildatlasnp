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

  const handleAddPermit = async (permitName: string, parkId: string) => {
    await s.toggleWatch(permitName, parkId);
  };

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
      {/* ── Dark Header Section ── */}
      <div style={{ background: "linear-gradient(180deg, #0B2B1B 0%, #051A10 100%)" }}>
        <div ref={headerFadeRef} style={{ padding: "32px 20px 0" }}>
          <h1
            style={{
              fontFamily: CORMORANT,
              fontSize: 56,
              fontWeight: 200,
              color: "#F0EDEA",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              opacity: "var(--header-opacity, 1)" as any,
              willChange: "opacity",
            }}
          >
            My Parks
          </h1>
          {/* Status summary */}
          <div className="flex items-center gap-2" style={{ marginTop: 6, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>
             <span
               style={{
                 fontFamily: CORMORANT,
                 fontSize: 16,
                 fontStyle: "italic",
                 fontWeight: 400,
                 color: "rgba(255,255,255,0.85)",
               }}
             >
              {s.watches.length === 0
                ? "No alerts yet"
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
                    fontSize: 10,
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
        <div style={{ marginBottom: 24 }} />

        {/* ── Mochi Insight Card (borderless) ── */}
        {s.watches.length > 0 && (
          <div style={{ marginBottom: 0 }}>
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
        <div style={{ padding: "0 0 14px" }}>
        {/* Section label */}
        {s.watches.length > 0 && (
           <div
            className="flex items-center justify-between"
            style={{ margin: "0 20px 14px", paddingTop: 28, marginTop: 28, borderTop: '1px solid rgba(240,237,234,0.12)' }}
          >
             <span
               style={{
                 fontFamily: DM_SANS,
                 fontSize: 10,
                 fontWeight: 500,
                 textTransform: "uppercase" as const,
                 letterSpacing: "0.12em",
                 color: "rgba(240,237,234,0.5)",
               }}
             >
              Watching
            </span>
            <span
               style={{
                 fontFamily: DM_SANS,
                 fontSize: 11,
                 fontWeight: 400,
                 color: "rgba(240,237,234,0.45)",
               }}
            >
              {s.watches.length} of {s.isPro ? "∞" : "1"} · {s.isPro ? "Pro" : "Free"}
            </span>
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
                <div style={{ width: 120 }}>
                  <img
                    src="/mochi-wave.png"
                    alt="Poko mascot waving hello"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <p style={{
                  fontFamily: CORMORANT,
                  fontSize: 24,
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
                  color: "rgba(240,237,234,0.70)",
                  textAlign: "center",
                  maxWidth: 260,
                  marginTop: 8,
                  lineHeight: 1.6,
                }}>
                  Add a permit and Poko will alert you the moment a spot opens.
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
                    marginTop: 24,
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

      {/* Gradient transition to Park Alerts */}
      <div style={{ height: 100, background: "linear-gradient(to bottom, #F2F1ED, #EAE8E3)" }} />

      {/* ── Park Alerts (secondary section) ── */}
      <div>
        <div style={{ background: "#EAE8E3", padding: "0 20px 0" }}>
          <ParkAlerts trackedParkIds={trackedParkIds} />
        </div>
      </div>

      {/* Inline "Watch a permit" button */}
      {s.user && (
        <div style={{ padding: '20px 16px 0' }}>
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
          margin: "0 12px 0",
          borderRadius: 12,
          overflow: "hidden",
          cursor: "pointer",
          border: "1px solid rgba(240,237,234,0.10)",
        }}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
      >
        <div>
        {/* Photo zone */}
        <div style={{ minHeight: 240, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #1C2E22 0%, #2F4A38 50%, #1A2820 100%)" }}>
          {parkConfig.heroImage ? (
            <img
              src={parkConfig.heroImage}
              alt={permitDef.name}
              loading="lazy"
              width={960}
              height={640}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
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
          {/* Gradient scrim */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "100%",
              background: "linear-gradient(to bottom, transparent 70%, rgba(0,0,0,0.68) 100%)",
            }}
          />
          {/* Liveness pill — scan timestamp */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.35)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderRadius: 20,
              padding: "4px 10px",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#2F6F4E",
                display: "block",
                flexShrink: 0,
                animation: "scanner-liveness-pulse 2s ease-in-out infinite",
              }}
            />
             <span
               style={{
                 fontFamily: DM_SANS,
                 fontSize: 12,
                 fontWeight: 400,
                 color: "#9CA3AF",
                 whiteSpace: "nowrap",
               }}
             >
              {scannedAgoText}
            </span>
          </div>
          {/* Park label */}
          <span
            style={{
              position: "absolute",
              top: 14,
              right: 16,
               fontFamily: DM_SANS,
               fontSize: 9,
               fontWeight: 500,
               letterSpacing: "0.06em",
               textTransform: "uppercase",
               color: "rgba(255,255,255,0.65)",
               background: "transparent",
               border: "0.5px solid rgba(255,255,255,0.35)",
               padding: "2px 8px",
               borderRadius: 4,
               zIndex: 2,
            }}
          >
            {parkConfig.shortName.toUpperCase()}
          </span>
          {/* Bottom-left text overlay: status + permit name */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {statusLabel}{seasonLabel ? ` · ${seasonLabel}` : ""}
            </span>
            <span
              style={{
                fontFamily: CORMORANT,
                fontSize: 26,
                fontWeight: 400,
                color: "#FFFFFF",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                textShadow: "0px 1px 12px rgba(0,0,0,0.5)",
              }}
            >
              {permitDef.name}
            </span>
          </div>
        </div>

        {/* Data strip — labeled expand affordance */}
        <div
          style={{
            background: "#ECEAE6",
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
            style={{
              color: "rgba(28,24,18,0.35)",
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
        </div>


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
              padding: "14px 14px 14px",
              borderTop: "1px solid rgba(28,24,18,0.08)",
              borderRadius: "0 0 12px 12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                borderLeft: "1.5px solid #C9A96E",
                padding: "10px 14px",
                background: "transparent",
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontFamily: CORMORANT,
                  fontSize: 15,
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "#1A2F1E",
                  lineHeight: 1.65,
                }}
              >
                Permits drop most often mid-week — I'll alert you instantly.
              </p>
            </div>

            {/* SMS toggle */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} style={{ color: smsEnabled ? "#2F6F4E" : "rgba(28,24,18,0.4)" }} />
                <span
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 13,
                    color: "rgba(26,47,30,0.70)",
                  }}
                >
                  SMS alerts
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNotify();
                }}
                style={{
                  width: 51,
                  height: 31,
                  borderRadius: 15.5,
                  background: smsEnabled ? "#2F6F4E" : "#E0E0E0",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                  padding: 0,
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
                    background: smsEnabled ? "#F0EDEA" : "#FFFFFF",
                    boxShadow: smsEnabled ? "0 1px 3px rgba(0,0,0,0.20)" : "none",
                    transition: "left 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
              </button>
            </div>

            {/* Remove link */}
            <div className="flex justify-end" style={{ paddingTop: 6, paddingBottom: 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="flex items-center gap-1"
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#B85450",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                <Trash2 size={12} />
                Remove
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
