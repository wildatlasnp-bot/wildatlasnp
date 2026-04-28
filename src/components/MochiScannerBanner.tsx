import { useState, useEffect } from "react";
import { Radar, ChevronRight, Radio, BellOff } from "lucide-react";
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
  const isStandby = !isEmpty && !isActive;

  /* ── EMPTY STATE ── */
  if (isEmpty) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="mx-4 mb-2 w-[calc(100%-2rem)] text-left active:scale-[0.99] transition-transform duration-200"
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
      </button>
    );
  }

  /* ── ACTIVE STATE — premium dark dispatch card ── */
  return (
    <button
      type="button"
      onClick={onTap}
      className="mx-4 mb-2 w-[calc(100%-2rem)] text-left active:scale-[0.99] transition-transform duration-200 relative overflow-hidden"
      style={{
        borderRadius: 14,
        padding: "14px 16px 13px",
        background:
          "linear-gradient(180deg, hsl(150 16% 18%) 0%, hsl(150 18% 13%) 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px -12px rgba(0,0,0,0.4)",
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
            {isActive ? (
              <span className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
                <span
                  aria-hidden
                  className="animate-pulse-soft absolute inline-flex rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    background: "hsl(var(--success-dot) / 0.18)",
                    boxShadow: "0 0 10px 2px hsl(var(--success-dot) / 0.45)",
                  }}
                />
                <Radio
                  size={11}
                  strokeWidth={2.25}
                  style={{ color: "hsl(var(--success-dot))", position: "relative" }}
                />
              </span>
            ) : (
              <Radar
                size={12}
                strokeWidth={1.75}
                style={{ color: "rgba(199, 232, 213, 0.55)" }}
              />
            )}
            <span
              style={{
                fontFamily: UI,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: isActive ? "rgba(199, 232, 213, 0.85)" : "rgba(199, 232, 213, 0.55)",
              }}
            >
              {isActive ? "Live · Monitoring" : "Standby"}
            </span>
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
    </button>
  );
}
