import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

/**
 * FleetParkPopover — tap-to-reveal detail card for a single park name in
 * the landing-page fleet log. Renders an accessible <button> that, when
 * activated, opens a small popover anchored to the trigger with:
 *
 *   - The park's last alert time (relative + absolute, in viewer's locale)
 *   - The most recent permit name (if any)
 *   - The number of finds in the last 7 days
 *
 * Detail is lazy-fetched on first open from `recent_finds` (public-read RLS,
 * works for unauthenticated visitors). No fake/placeholder data is shown —
 * if the park has no recorded finds, the popover honestly says so.
 *
 * Accessibility:
 *   - Trigger is a real button with role/keyboard semantics
 *   - Popover uses role="dialog" + aria-labelledby
 *   - Escape closes; outside click closes; focus returns to trigger on close
 *   - Respects prefers-reduced-motion via framer-motion
 */

interface ParkLite {
  id: string;
  label: string; // ALL CAPS source label, e.g. "GRAND CANYON"
  color: string;
}

interface FleetParkPopoverProps {
  park: ParkLite;
  /** Last alert timestamp from the parent fleet hook (avoids a refetch). */
  lastAlertAt: string | null;
  /** Whether to render the small "17H" / "3D" tail next to the name. */
  showAge: boolean;
  /** When true, rendered as the visually-quieter "standing by" variant. */
  muted?: boolean;
}

interface FleetParkDetail {
  loading: boolean;
  error: boolean;
  recentPermitName: string | null;
  recentLocation: string | null;
  windowCount: number;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function shortAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function shortAgoUpper(iso: string | null): string {
  return shortAgo(iso).toUpperCase();
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function FleetParkPopover({
  park,
  lastAlertAt,
  showAge,
  muted = false,
}: FleetParkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<FleetParkDetail>({
    loading: false,
    error: false,
    recentPermitName: null,
    recentLocation: null,
    windowCount: 0,
  });
  const hasFetched = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = `fleet-popover-${park.id}`;
  // Viewport-fixed coords computed from the trigger's bounding rect.
  // Recomputed on open + on resize/scroll while open.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const POPOVER_WIDTH_MAX = 320;
  const POPOVER_OFFSET_Y = 10;

  const computeCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const desiredLeft = rect.left;
    const maxLeft = window.innerWidth - POPOVER_WIDTH_MAX - margin;
    const left = Math.max(margin, Math.min(desiredLeft, maxLeft));
    const top = rect.bottom + POPOVER_OFFSET_Y;
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computeCoords();
    const onWin = () => computeCoords();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  // Lazy fetch on first open. Counts last 7 days of finds and grabs the
  // newest permit_name + location for context.
  useEffect(() => {
    if (!open || hasFetched.current) return;
    hasFetched.current = true;
    let cancelled = false;
    setDetail((d) => ({ ...d, loading: true, error: false }));

    (async () => {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [{ data: latest, error: latestErr }, { count, error: countErr }] =
        await Promise.all([
          supabase
            .from("recent_finds")
            .select("permit_name, location_name, found_at")
            .eq("park_id", park.id)
            .order("found_at", { ascending: false })
            .limit(1),
          supabase
            .from("recent_finds")
            .select("id", { count: "exact", head: true })
            .eq("park_id", park.id)
            .gte("found_at", sevenDaysAgo),
        ]);

      if (cancelled) return;

      const error = !!latestErr || !!countErr;
      const row = latest?.[0];
      setDetail({
        loading: false,
        error,
        recentPermitName: row?.permit_name ?? null,
        recentLocation: row?.location_name ?? null,
        windowCount: count ?? 0,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, park.id]);

  // Close on outside click + Escape; restore focus on close.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parkName = titleCase(park.label);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "baseline",
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: "6px 2px",
          margin: "-6px -2px",
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          whiteSpace: "nowrap",
          minHeight: 44, // WCAG 2.2 AA tap target
          lineHeight: "inherit",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 18,
            height: 2,
            background: park.color,
            transform: "translateY(-3px)",
            borderRadius: 1,
            opacity: muted ? 0.85 : 1,
            transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        <span
          style={{
            color: "#1A2F1E",
            borderBottom: open
              ? `1px solid ${park.color}`
              : "1px solid transparent",
            transition: "border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {parkName}
        </span>
        {showAge && lastAlertAt && (
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7A7A74",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {shortAgoUpper(lastAlertAt)}
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                id={popoverId}
                role="dialog"
                aria-labelledby={`${popoverId}-title`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  zIndex: 1000,
                  minWidth: 260,
                  maxWidth: POPOVER_WIDTH_MAX,
                  background: "#FAF7F3",
                  border: "1px solid rgba(26, 47, 30, 0.18)",
                  borderRadius: 8,
                  padding: "16px 18px 18px",
                  boxShadow:
                    "0 1px 2px rgba(26, 47, 30, 0.04), 0 8px 24px rgba(26, 47, 30, 0.10)",
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#1A2F1E",
                  textAlign: "left",
                  whiteSpace: "normal",
                }}
              >
            {/* Color tab */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 14,
                width: 28,
                height: 3,
                background: park.color,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />

            {/* Header — park name + close affordance */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h3
                id={`${popoverId}-title`}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 500,
                  fontSize: 22,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  color: "#1A2F1E",
                  margin: 0,
                }}
              >
                {parkName}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close park detail"
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  padding: 6,
                  margin: -6,
                  cursor: "pointer",
                  color: "rgba(26, 47, 30, 0.45)",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Last alert block */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.55)",
                  marginBottom: 4,
                }}
              >
                Last alert
              </div>
              {lastAlertAt ? (
                <div style={{ fontSize: 14, lineHeight: 1.45 }}>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: "#1A2F1E",
                    }}
                  >
                    {shortAgo(lastAlertAt)}
                  </span>
                  <span
                    style={{
                      color: "rgba(26, 47, 30, 0.45)",
                      margin: "0 6px",
                    }}
                  >
                    ·
                  </span>
                  <span style={{ color: "rgba(26, 47, 30, 0.7)" }}>
                    {formatAbsolute(lastAlertAt)}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.45,
                    fontStyle: "italic",
                    color: "rgba(26, 47, 30, 0.6)",
                    fontFamily: "'Cormorant Garamond', serif",
                  }}
                >
                  Standing by — no recorded finds yet.
                </div>
              )}
            </div>

            {/* Detail block — recent permit + 7d count */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(26, 47, 30, 0.55)",
                  marginBottom: 4,
                }}
              >
                Activity
              </div>

              {detail.loading ? (
                <div
                  aria-live="polite"
                  style={{
                    fontSize: 13,
                    fontStyle: "italic",
                    color: "rgba(26, 47, 30, 0.55)",
                    fontFamily: "'Cormorant Garamond', serif",
                  }}
                >
                  Reading the log…
                </div>
              ) : detail.error ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(26, 47, 30, 0.6)",
                  }}
                >
                  Couldn't reach the log. Try again in a moment.
                </div>
              ) : detail.recentPermitName ? (
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div style={{ color: "#1A2F1E" }}>
                    {detail.recentPermitName}
                  </div>
                  {detail.recentLocation && (
                    <div
                      style={{
                        color: "rgba(26, 47, 30, 0.6)",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {detail.recentLocation}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      color: "rgba(26, 47, 30, 0.6)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {detail.windowCount === 0
                      ? "No finds in the last 7 days."
                      : detail.windowCount === 1
                        ? "1 find in the last 7 days."
                        : `${detail.windowCount} finds in the last 7 days.`}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                    color: "rgba(26, 47, 30, 0.6)",
                    fontFamily: "'Cormorant Garamond', serif",
                  }}
                >
                  Quiet — nothing logged here yet. The watch keeps
                  running.
                </div>
              )}
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
