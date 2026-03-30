import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { LogIn, Radar, X, Clock, Plus, Radio, Mountain, ChevronDown, Trash2, MessageSquare } from "lucide-react";
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

import { useProStatus } from "@/hooks/useProStatus";

// Hero images now sourced from getParkConfig().heroImage

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

const SniperDashboard = () => {
  const navigate = useNavigate();
  const s = useSniperData();
  const scanner = useScannerStatus();
  const { isPro } = useProStatus();

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
      {/* ── Page Header ── */}
      <div style={{ padding: "24px 20px 0" }}>
        <h1
          style={{
            fontFamily: CORMORANT,
            fontSize: 38,
            fontWeight: 300,
            fontStyle: "italic",
            color: "#1C1812",
            lineHeight: 1.1,
          }}
        >
          My Parks
        </h1>
        <div
          style={{
            height: 1,
            background: "rgba(28,24,18,0.12)",
            margin: "8px 0 16px",
          }}
        />
      </div>

      {/* ── Mochi Insight Card (borderless) ── */}
      <MochiGlassCard />

      {/* ── Scanner Status Line ── */}
      <AnimatePresence>
        {s.watches.length > 0 && (
          <div
            style={{
              padding: "10px 20px",
              borderTop: "1px solid rgba(28,24,18,0.08)",
              borderBottom: "1px solid rgba(28,24,18,0.08)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex rounded-full shrink-0"
                style={{ width: 6, height: 6, backgroundColor: "#2F6F4E" }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: DM_SANS,
                  color: "#6B6B6B",
                }}
              >
                Scanner active · {scanner.lastSuccessfulScanAt ? scanner.getTimeAgo(scanner.lastSuccessfulScanAt) : "—"} · {s.isPro ? "Pro · 2-min" : "Free · 5-min"}
              </span>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Tracked Permits Section ── */}
      <div style={{ padding: "0 0 6px" }}>
        {/* Section label */}
        {s.watches.length > 0 && (
          <div
            className="flex items-center justify-between"
            style={{ margin: "20px 20px 12px" }}
          >
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.16em",
                color: "rgba(28,24,18,0.4)",
                textTransform: "uppercase",
              }}
            >
              WATCHING
            </span>
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 10,
                color: "rgba(28,24,18,0.35)",
              }}
            >
              {s.watches.length} of {s.isPro ? "∞" : "1"} · {s.isPro ? "Pro" : "Free"}
            </span>
          </div>
        )}

        {/* Empty state */}
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
              className="flex flex-col items-center justify-center gap-4"
              style={{
                margin: "0 20px",
                borderRadius: 20,
                border: "1px solid rgba(28,24,18,0.1)",
                background: "#FFFFFF",
                padding: "40px 24px",
              }}
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
                <p style={{ fontFamily: DM_SANS, fontSize: 15, fontWeight: 600, color: "#1C1812" }}>No active watches yet</p>
                <p style={{ fontFamily: DM_SANS, fontSize: 12, color: "#6B6B6B", maxWidth: 260 }}>
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
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "white",
                    background: "#2F6F4E",
                    padding: "12px 20px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
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
              <PermitPhotoCard
                key={watch.id}
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
              />
            );
          })
        )}

        {/* ── Add another park slot (free users) ── */}
        {!s.isPro && (
          <div
            style={{
              margin: "0 20px 14px",
              height: 80,
              borderRadius: 18,
              background: "linear-gradient(135deg, #1C3829 0%, #2F6F4E 100%)",
              border: "1.5px dashed rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              gap: 10,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onClick={() => s.setProModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && s.setProModalOpen(true)}
          >
            <Plus size={16} color="white" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "white" }}>Add another park</span>
            <span
              style={{
                marginLeft: "auto",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 99,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 600,
                color: "white",
              }}
            >
              Pro
            </span>
          </div>
        )}
      </div>

      {/* ── Park Alerts ── */}
      <div style={{ margin: "4px 0 20px", borderTop: "1px solid rgba(28,24,18,0.08)" }} />
      <div style={{ padding: "0 20px" }}>
        <ParkAlerts trackedParkIds={trackedParkIds} />
      </div>

      {/* Bottom safe-area padding */}
      <div className="pb-28" />
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
}: PermitPhotoCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const oddsPercent = 34; // placeholder

  const statusColor = "#3D6BA0";
  const statusLabel = "Pre-season";

  return (
    <>
      <div
        style={{
          margin: "0 20px 14px",
          borderRadius: 18,
          overflow: "hidden",
          border: "1.5px solid rgba(47,111,78,0.2)",
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
      >
        {/* Photo zone */}
        <div style={{ height: 200, position: "relative", overflow: "hidden", backgroundColor: "#1a1a1a" }}>
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
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
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
              height: 120,
              background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.65))",
            }}
          />
          {/* Park label */}
          <span
            style={{
              position: "absolute",
              top: 14,
              left: 16,
              fontFamily: DM_SANS,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
              zIndex: 2,
            }}
          >
            {parkConfig.shortName.toUpperCase()}
          </span>
          {/* Odds pill */}
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 99,
              padding: "6px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 18,
                fontWeight: 700,
                color: "white",
                lineHeight: 1.1,
              }}
            >
              {oddsPercent}%
            </span>
            <span
              style={{
                fontFamily: DM_SANS,
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.7)",
                display: "block",
                textAlign: "center",
              }}
            >
              ODDS
            </span>
          </div>
          {/* Permit name */}
          <span
            style={{
              position: "absolute",
              bottom: 14,
              left: 16,
              fontFamily: CORMORANT,
              fontSize: 28,
              fontWeight: 500,
              color: "white",
              zIndex: 2,
              lineHeight: 1.15,
            }}
          >
            {permitDef.name}
          </span>
        </div>

        {/* Data strip */}
        <div
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: statusColor,
                }}
              />
              <span
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
              <span
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 11,
                  color: "rgba(28,24,18,0.45)",
                }}
              >
                · {seasonLabel ?? "Year-round"} · {daysUntilSeason !== null && daysUntilSeason > 0 ? `${daysUntilSeason} days` : "In season"}
              </span>
            </div>
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
        </div>

        {/* Expanded panel */}
        <div
          style={{
            maxHeight: isExpanded ? 400 : 0,
            overflow: "hidden",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              padding: "12px 16px 8px",
              borderTop: "1px solid rgba(28,24,18,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mochi insight */}
            <div className="flex items-start gap-2 mb-3">
              <img
                src="/mochi-standing.png"
                alt=""
                style={{ height: 22, width: "auto", objectFit: "contain", flexShrink: 0, marginTop: 2, background: "none", borderRadius: 0 }}
              />
              <p
                style={{
                  fontFamily: DM_SANS,
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "#3D3D3D",
                  lineHeight: 1.45,
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
                    fontSize: 12,
                    color: "rgba(28,24,18,0.6)",
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
                  width: 40,
                  height: 24,
                  borderRadius: 12,
                  background: smsEnabled ? "#2F6F4E" : "rgba(28,24,18,0.12)",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                  padding: 0,
                }}
                aria-label={smsEnabled ? "Disable SMS" : "Enable SMS"}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: smsEnabled ? 18 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
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
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(226,75,74,0.7)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                <Trash2 size={11} />
                Remove
              </button>
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
              borderRadius: "18px 18px 0 0",
              padding: "24px 24px 80px",
              animation: "slide-up-sheet 0.25s ease-out",
            }}
          >
            <h3
              style={{
                fontFamily: CORMORANT,
                fontSize: 20,
                fontWeight: 500,
                color: "#1C1812",
                marginBottom: 6,
              }}
            >
              Remove {permitDef.name}?
            </h3>
            <p
              style={{
                fontFamily: DM_SANS,
                fontSize: 13,
                fontWeight: 300,
                color: "#6B6B6B",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              You'll stop receiving alerts for this permit. You can always add it back later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1,
                  fontFamily: DM_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1C1812",
                  background: "rgba(28,24,18,0.06)",
                  border: "1px solid rgba(28,24,18,0.12)",
                  borderRadius: 12,
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                Keep it
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
                style={{
                  flex: 1,
                  fontFamily: DM_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "white",
                  background: "#E24B4A",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                Remove
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
