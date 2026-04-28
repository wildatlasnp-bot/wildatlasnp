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

  return (
    <div style={{ background: "#0e1a10", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Ambient glow */}
      <div
        ref={ambRef}
        id="amb"
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: 220, zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 300px 200px at 50% -30px, rgba(47,111,78,0.22) 0%, transparent 70%)",
          transition: "background 4s ease",
        }}
      />

      {/* Top bar */}
      <div style={{ padding: "2px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => navigate("/app?tab=sniper")}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontFamily: F.dm, fontSize: 14, color: "rgba(244,240,232,0.45)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <ArrowLeftIcon /> Back
        </button>

        <div style={{
          borderRadius: 100, background: "rgba(47,111,78,0.14)", border: "1px solid rgba(47,111,78,0.32)",
          padding: "5px 12px", display: "flex", alignItems: "center", gap: 7,
        }}>
          <span ref={ldotRef} id="ldot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ec994", flexShrink: 0 }} />
          <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 500, color: "#6ec994", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Window open
          </span>
        </div>
      </div>

      {/* Hero zone */}
      <div style={{ padding: "6px 28px 0", position: "relative", zIndex: 1 }}>
        {/* Kicker */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <span style={{ display: "block", width: 20, height: 1, background: "rgba(201,169,110,0.4)" }} />
          <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(201,169,110,0.72)" }}>
            {permitName || "Timed Entry Permit"}
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: F.cg, fontSize: 70, fontWeight: 300, lineHeight: 0.88, margin: "0 0 17px", padding: 0 }}>
          <span style={{ display: "block", letterSpacing: "-0.02em", color: "#f4f0e8" }}>Permit</span>
          <span style={{ display: "block", fontStyle: "italic", letterSpacing: "-0.04em", color: "rgba(244,240,232,0.58)" }}>Available</span>
        </h1>

        {/* Park + date line */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 26 }}>
          {parkName && (
            <span style={{ fontFamily: F.dm, fontSize: 13, color: "rgba(244,240,232,0.52)" }}>{parkName}</span>
          )}
          {parkName && dateDisplay && (
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(201,169,110,0.5)", flexShrink: 0 }} />
          )}
          {dateDisplay && (
            <span style={{ fontFamily: F.dm, fontSize: 13, color: "rgba(201,169,110,0.72)" }}>{dateDisplay}</span>
          )}
        </div>

        {/* Amber rule */}
        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(201,169,110,0.32), transparent 68%)", marginBottom: 26 }} />
      </div>

      {/* Timer section */}
      <div style={{ padding: "0 28px", marginBottom: 6, position: "relative", zIndex: 1 }}>
        {/* Meta row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,240,232,0.26)" }}>
            Time since detection
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span ref={sdotRef} id="sdot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#6ec994", flexShrink: 0 }} />
            <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 400, color: "#6ec994" }}>Scanner active</span>
          </div>
        </div>

        {/* Timer row */}
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 22 }}>
          <span
            ref={timerRef}
            id="td"
            style={{
              fontFamily: F.jb, fontSize: 76, fontWeight: 300, letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums", color: "#f4f0e8",
              transition: "color 2s ease", lineHeight: 1,
            }}
          >
            0:00
          </span>
          <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 300, color: "rgba(244,240,232,0.28)", letterSpacing: "0.06em", marginLeft: 10 }}>
            elapsed
          </span>
        </div>
      </div>

      {/* Urgency strip */}
      <div style={{
        margin: "0 18px 22px", padding: "13px 16px",
        background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.28)",
        borderRadius: 18, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-start", gap: 12,
        position: "relative", zIndex: 1,
      }}>
        <TriangleIcon />
        <div>
          <div style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 500, color: "#C9A96E", marginBottom: 3 }}>
            Most permits vanish in 2–5 minutes
          </div>
          <div style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 300, color: "rgba(201,169,110,0.55)", lineHeight: 1.45 }}>
            Windows close without warning. Claim now or set a watch for the next release.
          </div>
        </div>
      </div>

      {/* Spacer pushes actions to bottom */}
      <div style={{ flex: 1 }} />

      {/* Actions zone */}
      <div style={{ padding: "0 18px 30px", display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
        {/* Row 1: Primary + Secondary */}
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {/* Primary CTA */}
          <button
            onClick={handleBook}
            style={{
              flex: "0 0 75%", position: "relative", overflow: "hidden",
              background: "#2F6F4E", border: "1px solid rgba(78,180,120,0.18)",
              borderRadius: 20, padding: "19px 20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: F.dm, fontSize: 15, fontWeight: 500, color: "#f4f0e8",
              cursor: "pointer", transition: "background 0.2s, transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#265E41"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#2F6F4E"; e.currentTarget.style.transform = "translateY(0)"; }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.984)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
          >
            {/* Top highlight line */}
            <span style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }} />
            <ExternalLinkIcon />
            Claim on Recreation.gov
          </button>

          {/* Secondary: Captured */}
          {!captured ? (
            <button
              onClick={handleCapture}
              style={{
                flex: 1, background: "rgba(244,240,232,0.05)", border: "1px solid rgba(244,240,232,0.10)",
                borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 5, cursor: "pointer", padding: "12px 8px",
              }}
            >
              <CheckIcon />
              <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 300, color: "rgba(244,240,232,0.35)" }}>Captured</span>
            </button>
          ) : (
            <div style={{
              flex: 1, background: "rgba(47,111,78,0.15)", border: "1px solid rgba(78,180,120,0.25)",
              borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              <CheckIcon />
              <span style={{ fontFamily: F.dm, fontSize: 12, fontWeight: 300, color: "#6ec994" }}>Done</span>
            </div>
          )}
        </div>

        {/* Row 2: Ghost keep watching */}
        <button
          onClick={() => navigate("/app?tab=sniper")}
          style={{
            width: "100%", background: "none", border: "none", padding: "10px 0",
            fontFamily: F.dm, fontSize: 12, fontWeight: 300, color: "rgba(244,240,232,0.22)",
            cursor: "pointer", textAlign: "center",
          }}
        >
          This date doesn't work — keep watching
        </button>
      </div>
    </div>
  );
};

export default AlertDetailPage;
