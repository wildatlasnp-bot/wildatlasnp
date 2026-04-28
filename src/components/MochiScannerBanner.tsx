import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Radio, BellOff, Loader, CloudOff, PauseCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ScannerState } from "@/lib/scanner-status";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { PARKS } from "@/lib/parks";

interface TrackedPermitInfo {
  permit_name: string;
  park_id: string;
  created_at?: string;
}

const SCAN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const DISPLAY = "'Cormorant Garamond', serif";
const UI = "'DM Sans', sans-serif";

type StateVisual = {
  icon: LucideIcon;
  label: string;
  iconColor: string;
  labelColor: string;
  iconAnim?: "spin" | "pulse" | "flicker" | "none";
  haloColor?: string;
};

// Color tokens
const SUCCESS = "hsl(var(--success-dot))";
const SUCCESS_HALO = "hsl(var(--success-dot) / 0.45)";
const AMBER = "rgb(214, 168, 99)";
const AMBER_HALO = "rgba(214, 168, 99, 0.45)";
const CRIMSON = "rgb(212, 110, 95)";
const CRIMSON_HALO = "rgba(212, 110, 95, 0.5)";
const MIST = "rgba(199, 232, 213, 0.55)";
const MIST_LABEL_DIM = "rgba(199, 232, 213, 0.55)";
const MIST_LABEL_BRIGHT = "rgba(199, 232, 213, 0.85)";

const STATE_VISUALS: Record<ScannerState, StateVisual> = {
  active: {
    icon: Radio,
    label: "Live · Monitoring",
    iconColor: SUCCESS,
    labelColor: MIST_LABEL_BRIGHT,
    iconAnim: "pulse",
    haloColor: SUCCESS_HALO,
  },
  starting: {
    icon: Loader,
    label: "Warming up",
    iconColor: AMBER,
    labelColor: "rgba(229, 198, 148, 0.85)",
    iconAnim: "spin",
  },
  delayed: {
    icon: CloudOff,
    label: "Catching up",
    iconColor: AMBER,
    labelColor: "rgba(229, 198, 148, 0.85)",
    iconAnim: "flicker",
    haloColor: AMBER_HALO,
  },
  paused: {
    icon: PauseCircle,
    label: "Standby",
    iconColor: MIST,
    labelColor: MIST_LABEL_DIM,
    iconAnim: "none",
  },
  error: {
    icon: AlertTriangle,
    label: "Connection lost",
    iconColor: CRIMSON,
    labelColor: "rgba(232, 178, 168, 0.9)",
    iconAnim: "flicker",
    haloColor: CRIMSON_HALO,
  },
};

export default function MochiScannerBanner({
  trackedPermits,
  onTap,
}: {
  trackedPermits: TrackedPermitInfo[];
  onTap?: () => void;
}) {
  const { scannerState, lastSuccessfulScanAt } = useScannerStatus();
  const lastCheckLabel = useRelativeTime(lastSuccessfulScanAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const estimatedChecks = (() => {
    const earliest = trackedPermits.reduce<number | null>((min, p) => {
      if (!p.created_at) return min;
      const t = new Date(p.created_at).getTime();
      return min === null ? t : Math.min(min, t);
    }, null);
    if (earliest === null) return null;
    const elapsedMs = Math.max(0, now - earliest);
    return Math.floor(elapsedMs / SCAN_INTERVAL_MS);
  })();

  let permitTitle: string;
  let parkName: string;
  if (trackedPermits.length === 0) {
    permitTitle = "Poko is ready to watch permits for you";
    parkName = "";
  } else if (trackedPermits.length === 1) {
    const p = trackedPermits[0];
    permitTitle = p.permit_name;
    parkName = PARKS[p.park_id]?.shortName || "your park";
  } else {
    const parkIds = [...new Set(trackedPermits.map((p) => p.park_id))];
    permitTitle = `${trackedPermits.length} permits`;
    parkName =
      parkIds.length === 1
        ? PARKS[parkIds[0]]?.shortName || "1 park"
        : `${parkIds.length} parks`;
  }

  const isActive = scannerState === "active";
  const isEmpty = trackedPermits.length === 0;
  const visual = STATE_VISUALS[scannerState];
  const StateIcon = visual.icon;

  const shellTransition = { duration: 0.42, ease: [0.4, 0, 0.2, 1] as const };

  /* ── EMPTY STATE ── */
  if (isEmpty) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key="empty-shell"
          type="button"
          onClick={onTap}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={shellTransition}
          className="mx-4 mb-2 w-[calc(100%-2rem)] text-left active:scale-[0.99] transition-transform duration-200 block"
          style={{
            borderRadius: 14,
            padding: "16px 18px",
            background: "rgba(28, 56, 40, 0.035)",
            border: "1px solid rgba(28, 56, 40, 0.07)",
          }}
        >
          <div className="flex items-center gap-3.5">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(28, 56, 40, 0.055)",
            }}
          >
            <BellOff size={15} style={{ color: "rgba(28, 56, 40, 0.38)" }} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontFamily: UI,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(28, 56, 40, 0.35)",
                lineHeight: 1,
                marginBottom: 5,
              }}
            >
              Empty
            </p>
            <p
              style={{
                fontFamily: DISPLAY,
                fontSize: 15,
                fontWeight: 500,
                fontStyle: "italic",
                color: "rgba(28, 56, 40, 0.58)",
                lineHeight: 1.25,
              }}
            >
              {permitTitle}
            </p>
          </div>
          <ChevronRight size={14} style={{ color: "rgba(28, 56, 40, 0.25)" }} className="shrink-0" />
          </div>
        </motion.button>
      </AnimatePresence>
    );
  }

  /* ── ACTIVE STATE — premium dark dispatch card ── */
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.button
        key="active-shell"
        type="button"
        onClick={onTap}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={shellTransition}
        className="mx-4 mb-2 w-[calc(100%-2rem)] text-left active:scale-[0.99] transition-transform duration-200 relative overflow-hidden block"
        style={{
          borderRadius: 14,
          padding: "14px 16px 13px",
          background:
            scannerState === "error"
              ? "linear-gradient(180deg, hsl(8 22% 18%) 0%, hsl(150 18% 13%) 100%)"
              : scannerState === "delayed" || scannerState === "starting"
              ? "linear-gradient(180deg, hsl(36 18% 19%) 0%, hsl(150 18% 13%) 100%)"
              : "linear-gradient(180deg, hsl(150 16% 18%) 0%, hsl(150 18% 13%) 100%)",
          boxShadow:
            scannerState === "error"
              ? "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(212,110,95,0.18), 0 8px 24px -12px rgba(0,0,0,0.45)"
              : "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px -12px rgba(0,0,0,0.4)",
        }}
      >
      {/* Subtle radial sheen, top-left */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -40,
          left: -30,
          width: 180,
          height: 120,
          background:
            "radial-gradient(ellipse at center, rgba(199,232,213,0.08) 0%, rgba(199,232,213,0) 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Hairline divider under header row */}
      <div className="relative">
        {/* Header row: LIVE eyebrow + last check */}
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`icon-${scannerState}`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="inline-flex items-center justify-center"
                style={{ width: 14, height: 14 }}
              >
                <span className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
                  {visual.haloColor && (
                    <span
                      aria-hidden
                      className={visual.iconAnim === "pulse" ? "animate-pulse-soft" : "animate-pulse"}
                      style={{
                        position: "absolute",
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: visual.haloColor.replace("0.45", "0.18").replace("0.5", "0.18"),
                        boxShadow: `0 0 10px 2px ${visual.haloColor}`,
                      }}
                    />
                  )}
                  <StateIcon
                    size={isActive ? 11 : 12}
                    strokeWidth={isActive ? 2.25 : 1.85}
                    style={{
                      color: visual.iconColor,
                      position: "relative",
                      animation:
                        visual.iconAnim === "spin"
                          ? "spin 1.6s linear infinite"
                          : visual.iconAnim === "flicker"
                          ? "scanner-flicker 1.8s ease-in-out infinite"
                          : undefined,
                    }}
                  />
                </span>
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`label-${scannerState}`}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  fontFamily: UI,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: visual.labelColor,
                  display: "inline-block",
                }}
              >
                {visual.label}
              </motion.span>
            </AnimatePresence>
          </div>
          <span
            style={{
              fontFamily: UI,
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {lastCheckLabel}
          </span>
        </div>

        {/* Body: permit title + park */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="truncate"
              style={{
                fontFamily: DISPLAY,
                fontSize: 19,
                fontWeight: 500,
                lineHeight: 1.15,
                color: "rgba(255,255,255,0.96)",
                letterSpacing: "-0.005em",
              }}
            >
              {permitTitle}
            </p>
            {parkName && (
              <p
                style={{
                  fontFamily: UI,
                  fontSize: 11,
                  fontWeight: 400,
                  color: "rgba(199, 232, 213, 0.55)",
                  marginTop: 3,
                  letterSpacing: "0.02em",
                }}
              >
                {parkName}
              </p>
            )}
          </div>
          <ChevronRight
            size={15}
            className="shrink-0"
            style={{ color: "rgba(255,255,255,0.32)", marginTop: 4 }}
          />
        </div>

        {/* Hairline */}
        <div
          aria-hidden
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0.08) 82%, rgba(255,255,255,0) 100%)",
            margin: "11px 0 8px",
          }}
        />

        {/* Footer telemetry: checks · drop window */}
        <div className="flex items-center justify-between gap-3">
          {estimatedChecks !== null && estimatedChecks > 0 ? (
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 14,
                  fontWeight: 500,
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1,
                }}
              >
                {estimatedChecks.toLocaleString()}
              </span>
              <span
                style={{
                  fontFamily: UI,
                  fontSize: 9.5,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                checks logged
              </span>
            </div>
          ) : (
            <span
              style={{
                fontFamily: UI,
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Scan in progress
            </span>
          )}
          <span
            style={{
              fontFamily: UI,
              fontSize: 10,
              fontStyle: "italic",
              fontWeight: 400,
              color: "rgba(199, 232, 213, 0.5)",
              whiteSpace: "nowrap",
            }}
          >
            Drops typically 6–8 AM
          </span>
        </div>
      </div>
      </motion.button>
    </AnimatePresence>
  );
}
