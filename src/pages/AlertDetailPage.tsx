import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/* ── Google Fonts (JetBrains Mono not in index.html) ── */
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300&display=swap";

function resolvePermitName(params: URLSearchParams): string {
  return (
    params.get("watch_name") ||
    params.get("permit_name") ||
    params.get("permit") ||
    params.get("facility_name") ||
    params.get("name") ||
    ""
  );
}

function parseFirstDateRange(rawDates: string): string | null {
  if (!rawDates) return null;
  const parts = rawDates.split(",").map((d) => d.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const fmt = (s: string) => {
    const [dateStr] = s.split(":");
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };
  if (parts.length === 1) return fmt(parts[0]);
  const first = fmt(parts[0]);
  const last = fmt(parts[parts.length - 1]);
  const [m1] = first.split(" ");
  const [, d2] = last.split(" ");
  if (m1 === last.split(" ")[0]) return `${first}–${d2}`;
  return `${first} – ${last}`;
}

/* useElapsedTimer removed — timer is now ref-driven in Pass 2 useEffect */

/* ── SVG Icons ── */
const ArrowLeftIcon = () => (
  <span style={{ width: 14, height: 14, display: "inline-flex" }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  </span>
);

const ExternalLinkIcon = () => (
  <span style={{ width: 16, height: 16, display: "inline-flex", opacity: 0.7 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  </span>
);

const CheckIcon = () => (
  <span style={{ width: 17, height: 17, display: "inline-flex" }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(244,240,232,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </span>
);

const TriangleIcon = () => (
  <span style={{ width: 17, height: 17, display: "inline-flex", flexShrink: 0, opacity: 0.88 }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  </span>
);

const AlertDetailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const permitName = resolvePermitName(params);
  const parkName = params.get("park") ?? "";
  const rawDates = params.get("dates") ?? "";
  const bookingUrl = params.get("url") ?? "https://www.recreation.gov";
  const watchId = params.get("wid") ?? "";
  const detectedAt = params.get("detected") ?? null;

  const dateDisplay = useMemo(() => parseFirstDateRange(rawDates), [rawDates]);

  const [captured, setCaptured] = useState(false);

  /* ── DOM refs ── */
  const ambRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const ldotRef = useRef<HTMLSpanElement>(null);
  const sdotRef = useRef<HTMLSpanElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Inject JetBrains Mono if not present ── */
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      document.head.appendChild(link);
    }
  }, []);

  /* ── Pass 2: Motion — heartbeat + timer + atmosphere ── */
  useEffect(() => {
    // Staccato heartbeat via chained setTimeout
    function heartbeat(dot: HTMLSpanElement, onDone?: () => void) {
      const steps = [
        { opacity: "1", delay: 80 },
        { opacity: "0.15", delay: 120 },
        { opacity: "1", delay: 80 },
        { opacity: "0.15", delay: 2400 },
      ];
      let i = 0;
      function tick() {
        if (!dot) return;
        dot.style.opacity = steps[i].opacity;
        heartbeatRef.current = setTimeout(() => {
          i = (i + 1) % steps.length;
          if (i === 0 && onDone) onDone();
          tick();
        }, steps[i].delay);
      }
      tick();
    }

    // Start ldot immediately
    if (ldotRef.current) {
      heartbeat(ldotRef.current);
    }
    // Start sdot with 300ms phase offset
    const sdotDelay = setTimeout(() => {
      if (sdotRef.current) {
        heartbeat(sdotRef.current);
      }
    }, 300);

    // Timer interval — imperative DOM updates
    const detectedMs = detectedAt ? new Date(detectedAt).getTime() : NaN;
    let s = isNaN(detectedMs) ? 0 : Math.max(0, Math.floor((Date.now() - detectedMs) / 1000));

    // Set initial value
    const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const ss = sec % 60;
      return `${m}<span style="letter-spacing:0em">:</span>${ss.toString().padStart(2, "0")}`;
    };
    if (timerRef.current) timerRef.current.innerHTML = formatTime(s);

    timerIntervalRef.current = setInterval(() => {
      s++;
      if (timerRef.current) {
        timerRef.current.innerHTML = formatTime(s);

        // Color shift at 60s
        if (s === 60) {
          timerRef.current.style.color = "rgba(201,169,110,1.0)";
        }
      }

      // Atmosphere shift
      if (ambRef.current) {
        const t = Math.min(s / 120, 1);
        const R = Math.round(47 + 13 * t);
        const G = Math.round(111 - 61 * t);
        const B = Math.round(78 - 48 * t);
        const opacity = (0.22 - t * 0.04).toFixed(3);
        ambRef.current.style.background =
          `radial-gradient(ellipse 300px 200px at 50% -30px, rgba(${R},${G},${B},${opacity}) 0%, transparent 70%)`;
      }
    }, 1000);

    return () => {
      if (heartbeatRef.current) clearTimeout(heartbeatRef.current);
      clearTimeout(sdotDelay);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [detectedAt]);

  const handleBook = () => {
    const FALLBACK_URL = "https://www.recreation.gov";
    let targetUrl = FALLBACK_URL;
    try {
      const parsed = new URL(bookingUrl);
      if (parsed.protocol === "https:" && (parsed.hostname === "recreation.gov" || parsed.hostname === "www.recreation.gov")) {
        targetUrl = bookingUrl;
      }
    } catch { /* fallback */ }
    window.open(targetUrl, "_blank", "noopener");
  };

  const handleCapture = async () => {
    setCaptured(true);
    if (watchId) {
      try {
        await supabase
          .from("user_watchers")
          .update({ status: "captured", is_active: false })
          .eq("id", watchId);
      } catch (e) {
        console.error("Failed to log capture:", e);
      }
    }
    setTimeout(() => navigate("/app?tab=sniper"), 2500);
  };

  const F = {
    cg: "'Cormorant Garamond', serif",
    dm: "'DM Sans', sans-serif",
    jb: "'JetBrains Mono', monospace",
  };

  // Issue number — day of year for editorial flavor
  const issueNo = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    return String(Math.floor(diff / 86400000)).padStart(3, "0");
  }, []);

  // Detection timestamp — formatted for the "DET" subdial
  const detectedDisplay = useMemo(() => {
    if (!detectedAt) return "—";
    try {
      return new Date(detectedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "—";
    }
  }, [detectedAt]);

  const INK = "#0c1710";
  const PAPER = "#f4f0e8";
  const PAPER_MUTED = "rgba(244,240,232,0.52)";
  const PAPER_FAINT = "rgba(244,240,232,0.28)";
  const GOLD = "#C9A96E";
  const GOLD_SOFT = "rgba(201,169,110,0.72)";
  const GOLD_FAINT = "rgba(201,169,110,0.18)";
  const RULE = "rgba(244,240,232,0.10)";
  const EMERALD = "#2F6F4E";

  // Tiny corner registration mark — printer's tick
  const CornerMark = ({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) => {
    const pos: React.CSSProperties = {
      position: "absolute",
      width: 10,
      height: 10,
      pointerEvents: "none",
      zIndex: 2,
      opacity: 0.42,
    };
    if (corner === "tl") { pos.top = 14; pos.left = 14; }
    if (corner === "tr") { pos.top = 14; pos.right = 14; }
    if (corner === "bl") { pos.bottom = 14; pos.left = 14; }
    if (corner === "br") { pos.bottom = 14; pos.right = 14; }
    const isTop = corner === "tl" || corner === "tr";
    const isLeft = corner === "tl" || corner === "bl";
    return (
      <span aria-hidden="true" style={pos}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d={
              `M ${isLeft ? 0 : 10} ${isTop ? 5 : 5} L ${isLeft ? 10 : 0} ${isTop ? 5 : 5} ` +
              `M ${isLeft ? 5 : 5} ${isTop ? 0 : 10} L ${isLeft ? 5 : 5} ${isTop ? 10 : 0}`
            }
            stroke={GOLD}
            strokeWidth="0.75"
          />
        </svg>
      </span>
    );
  };

  // Diamond ornament glyph for ornament rules
  const Diamond = () => (
    <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }}>
      <path d="M3 0 L6 3 L3 6 L0 3 Z" fill={GOLD} opacity="0.9" />
    </svg>
  );

  return (
    <div
      style={{
        background: INK,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        color: PAPER,
      }}
    >
      {/* Atmospheric layers — vignette + grain + ambient glow */}
      <div
        ref={ambRef}
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: 280, zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 320px 220px at 50% -40px, rgba(47,111,78,0.22) 0%, transparent 70%)",
          transition: "background 4s ease",
        }}
      />
      {/* Soft vignette around the edges */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      {/* Film grain — SVG noise texture */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          opacity: 0.06, mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Registration marks — printer's ticks at each corner */}
      <CornerMark corner="tl" />
      <CornerMark corner="tr" />
      <CornerMark corner="bl" />
      <CornerMark corner="br" />

      {/* ── Masthead: dispatch number + coordinates ── */}
      <div
        style={{
          padding: "20px 28px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          onClick={() => navigate("/app?tab=sniper")}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontFamily: F.dm, fontSize: 12, color: PAPER_FAINT,
            display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.02em",
          }}
          aria-label="Back to alerts"
        >
          <ArrowLeftIcon /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span ref={ldotRef} style={{ width: 5, height: 5, borderRadius: "50%", background: "#6ec994", flexShrink: 0 }} />
          <span style={{
            fontFamily: F.jb, fontSize: 10, color: GOLD_SOFT,
            letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
            Live · Window Open
          </span>
        </div>
      </div>

      {/* Editorial masthead bar */}
      <div style={{ padding: "18px 28px 0", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingBottom: 12, borderBottom: `1px solid ${RULE}`,
        }}>
          <span style={{
            fontFamily: F.cg, fontStyle: "italic", fontSize: 13, color: PAPER_MUTED,
            letterSpacing: "0.02em",
          }}>
            The Wild Atlas Dispatch
          </span>
          <span style={{
            fontFamily: F.jb, fontSize: 10, color: PAPER_FAINT,
            letterSpacing: "0.16em", textTransform: "uppercase",
          }}>
            № {issueNo}
          </span>
        </div>
      </div>

      {/* ── Hero: kicker + single italic headline + ornament ── */}
      <div style={{ padding: "32px 28px 0", position: "relative", zIndex: 1 }}>
        {/* Kicker — permit name, small caps */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
          <span style={{ display: "block", width: 16, height: 1, background: GOLD_SOFT }} />
          <span style={{
            fontFamily: F.dm, fontSize: 10, fontWeight: 500,
            letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD_SOFT,
          }}>
            {permitName || "Timed Entry Permit"}
          </span>
        </div>

        {/* Editorial headline — single line, italic Cormorant */}
        <h1 style={{
          fontFamily: F.cg, fontSize: 54, fontWeight: 300, lineHeight: 0.96,
          margin: "0 0 18px", padding: 0, letterSpacing: "-0.025em",
        }}>
          <span style={{ color: PAPER }}>A window </span>
          <span style={{ fontStyle: "italic", color: GOLD }}>has opened</span>
          <span style={{ color: PAPER }}>.</span>
        </h1>

        {/* Park · date dek */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
          {parkName && (
            <span style={{ fontFamily: F.cg, fontStyle: "italic", fontSize: 14, color: PAPER_MUTED }}>
              {parkName}
            </span>
          )}
          {parkName && dateDisplay && <Diamond />}
          {dateDisplay && (
            <span style={{ fontFamily: F.jb, fontSize: 11, color: GOLD_SOFT, letterSpacing: "0.04em" }}>
              {dateDisplay}
            </span>
          )}
        </div>

        {/* Ornament rule — gold hairlines + center diamond */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD_FAINT})` }} />
          <Diamond />
          <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${GOLD_FAINT}, transparent)` }} />
        </div>
      </div>

      {/* ── Chronograph: tabular timer + three subdials ── */}
      <div style={{ padding: "0 28px", position: "relative", zIndex: 1 }}>
        {/* Subdial label row */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 6,
        }}>
          <span style={{
            fontFamily: F.jb, fontSize: 9, color: PAPER_FAINT,
            letterSpacing: "0.22em", textTransform: "uppercase",
          }}>
            Elapsed
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span ref={sdotRef} style={{ width: 5, height: 5, borderRadius: "50%", background: "#6ec994", flexShrink: 0 }} />
            <span style={{
              fontFamily: F.jb, fontSize: 9, color: "#6ec994",
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              Scanning
            </span>
          </div>
        </div>

        {/* Big tabular timer */}
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 18 }}>
          <span
            ref={timerRef}
            style={{
              fontFamily: F.jb, fontSize: 88, fontWeight: 300, letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums", color: PAPER,
              transition: "color 2s ease", lineHeight: 1,
            }}
          >
            0:00
          </span>
        </div>

        {/* Three subdial readouts: DET · DURATION · WIN */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
          background: RULE,
          border: `1px solid ${RULE}`,
          borderRadius: 2,
          marginBottom: 22,
        }}>
          {[
            { label: "Detected", value: detectedDisplay },
            { label: "Window", value: dateDisplay || "Open" },
            { label: "Status", value: "Live" },
          ].map((cell, i) => (
            <div key={i} style={{
              background: INK, padding: "12px 12px",
              display: "flex", flexDirection: "column", gap: 4,
              alignItems: i === 1 ? "center" : i === 2 ? "flex-end" : "flex-start",
            }}>
              <span style={{
                fontFamily: F.jb, fontSize: 9, color: PAPER_FAINT,
                letterSpacing: "0.2em", textTransform: "uppercase",
              }}>
                {cell.label}
              </span>
              <span style={{
                fontFamily: F.cg, fontStyle: "italic", fontSize: 16,
                color: PAPER, letterSpacing: "-0.01em", lineHeight: 1,
              }}>
                {cell.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Editorial urgency lede — italic, no boxy alert ── */}
      <div style={{ padding: "0 28px 0", position: "relative", zIndex: 1, marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ paddingTop: 6 }}>
            <span style={{
              display: "block", width: 1, height: 36, background: GOLD,
              opacity: 0.65,
            }} />
          </div>
          <p style={{
            margin: 0, fontFamily: F.cg, fontStyle: "italic", fontSize: 17,
            lineHeight: 1.35, color: PAPER, letterSpacing: "-0.005em",
          }}>
            Most windows close in two to five minutes.
            <span style={{ color: PAPER_MUTED }}> Claim now, or set a watch for the next release.</span>
          </p>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, minHeight: 12 }} />

      {/* ── Actions ── */}
      <div style={{
        padding: "0 22px calc(env(safe-area-inset-bottom, 0px) + 24px)",
        display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 1,
      }}>
        {/* Primary CTA — engraved emerald with gold hairline frame */}
        <button
          onClick={handleBook}
          style={{
            position: "relative", overflow: "hidden",
            background: `linear-gradient(180deg, #357A57 0%, ${EMERALD} 100%)`,
            border: `1px solid ${GOLD_FAINT}`,
            borderRadius: 4,
            padding: "20px 22px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: F.dm, fontSize: 14, fontWeight: 500, color: PAPER,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
            transition: "transform 160ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms",
            boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 12px 28px -16px rgba(0,0,0,0.6)",
          }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.985)"; }}
          onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {/* Top engraved highlight */}
          <span style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "rgba(255,255,255,0.16)" }} />
          {/* Inner gold hairline frame */}
          <span aria-hidden="true" style={{
            position: "absolute", inset: 4, border: `1px solid ${GOLD_FAINT}`, borderRadius: 2, pointerEvents: "none",
          }} />
          <span style={{ position: "relative" }}>Claim on Recreation.gov</span>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <ExternalLinkIcon />
          </span>
        </button>

        {/* Secondary row: Captured + Keep watching */}
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {!captured ? (
            <button
              onClick={handleCapture}
              style={{
                flex: 1, background: "transparent", border: `1px solid ${RULE}`,
                borderRadius: 4, padding: "14px 12px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: "pointer",
                fontFamily: F.dm, fontSize: 11, fontWeight: 500,
                color: PAPER_MUTED, letterSpacing: "0.14em", textTransform: "uppercase",
              }}
            >
              <CheckIcon />
              <span>Mark captured</span>
            </button>
          ) : (
            <div style={{
              flex: 1, background: "rgba(47,111,78,0.15)",
              border: "1px solid rgba(78,180,120,0.25)",
              borderRadius: 4, padding: "14px 12px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.dm, fontSize: 11, fontWeight: 500,
              color: "#6ec994", letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              <CheckIcon />
              <span>Captured</span>
            </div>
          )}

          <button
            onClick={() => navigate("/app?tab=sniper")}
            style={{
              flex: 1, background: "transparent", border: `1px solid ${RULE}`,
              borderRadius: 4, padding: "14px 12px",
              fontFamily: F.dm, fontSize: 11, fontWeight: 500,
              color: PAPER_FAINT, letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Keep watching
          </button>
        </div>

        {/* Footer signature */}
        <div style={{
          marginTop: 4, display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 12, height: 1, background: GOLD_FAINT }} />
          <span style={{
            fontFamily: F.cg, fontStyle: "italic", fontSize: 11, color: PAPER_FAINT,
            letterSpacing: "0.04em",
          }}>
            Filed by Poko, your field cartographer
          </span>
          <span style={{ width: 12, height: 1, background: GOLD_FAINT }} />
        </div>
      </div>
    </div>
  );
};

export default AlertDetailPage;
