import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

function useElapsedTimer(detectedAt: string | null): { display: string; seconds: number } {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!detectedAt) return { display: "0:00", seconds: 0 };
  const t = new Date(detectedAt).getTime();
  if (isNaN(t)) return { display: "0:00", seconds: 0 };
  const totalSec = Math.max(0, Math.floor((now - t) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return { display: `${min}:${sec.toString().padStart(2, "0")}`, seconds: totalSec };
}

const LightningIcon = () => (
  <span style={{ width: 12, height: 12, display: "inline-flex" }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  </span>
);

const ClockIcon = () => (
  <span style={{ width: 20, height: 20, display: "inline-flex" }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  </span>
);

const AlertIcon = () => (
  <span style={{ width: 16, height: 16, display: "inline-flex", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a5a1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  </span>
);

const ArrowLeftIcon = () => (
  <span style={{ width: 14, height: 14, display: "inline-flex" }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  </span>
);

const ExternalLinkIcon = () => (
  <span style={{ width: 16, height: 16, display: "inline-flex" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
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
  const elapsed = useElapsedTimer(detectedAt);

  const [captured, setCaptured] = useState(false);

  const timerColor = elapsed.seconds >= 120 ? "#ff6b6b" : elapsed.seconds >= 60 ? "#f59e0b" : "#fff";

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

  const subtitle = [permitName, dateDisplay].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#1A2F1E", padding: "20px 20px 28px", flexShrink: 0 }}>
        {/* Row 1: Back + Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => navigate("/app?tab=sniper")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.08)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "6px 12px",
              color: "rgba(255,255,255,0.7)", fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >
            <ArrowLeftIcon /> Back
          </button>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(201,169,110,0.15)",
            border: "0.5px solid rgba(201,169,110,0.3)",
            borderRadius: 20, padding: "5px 10px",
          }}>
            <LightningIcon />
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "#C9A96E", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.06em" }}>
              Permit window open
            </span>
          </div>
        </div>

        {/* Permit info */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', sans-serif", margin: 0, fontWeight: 500 }}>
            {permitName || "Timed Entry Permit"}
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: "#fff", lineHeight: 1.15, margin: "6px 0 0" }}>
            {parkName || "Permit Available"}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', sans-serif", margin: "8px 0 0" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Timer card */}
        <div style={{
          marginTop: 16, background: "rgba(0,0,0,0.25)", borderRadius: 12,
          padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', sans-serif", margin: 0, letterSpacing: "0.06em" }}>
              Time since detection
            </p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: timerColor, margin: "4px 0 0", lineHeight: 1, transition: "color 0.3s ease" }}>
              {elapsed.display}
            </p>
          </div>
          <span style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.08)", borderRadius: "50%" }}>
            <ClockIcon />
          </span>
        </div>

        {/* Status row */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 0 3px rgba(74,222,128,0.2)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', sans-serif" }}>
            Just detected — scanner active
          </span>
        </div>
      </div>

      {/* Warning band */}
      <div style={{ background: "#1A2F1E", padding: "12px 16px 16px" }}>
        <div style={{
          background: "#C9A96E", borderRadius: 10,
          padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertIcon />
          <span style={{ fontSize: 13, fontWeight: 500, color: "#5a3f0d", fontFamily: "'DM Sans', sans-serif" }}>
            Most permits vanish within 2–5 minutes of release
          </span>
        </div>
      </div>

      {/* Actions body */}
      <div style={{
        background: "#fff", padding: 20, flex: 1,
        display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 8,
      }}>
        {/* Primary */}
        <button
          onClick={handleBook}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#2F6F4E", border: "none", borderRadius: 12, padding: 16,
            fontSize: 16, fontWeight: 500, color: "#fff", fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#265E41")}
          onMouseLeave={e => (e.currentTarget.style.background = "#2F6F4E")}
        >
          <ExternalLinkIcon />
          Claim on Recreation.gov →
        </button>

        {/* Secondary */}
        {!captured && (
          <button
            onClick={handleCapture}
            style={{
              width: "100%", background: "#f5f5f5", border: "0.5px solid #e0e0e0",
              borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 500,
              color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}
          >
            Mark as captured
          </button>
        )}

        {/* Tertiary */}
        <p
          onClick={() => navigate("/app?tab=sniper")}
          style={{
            textAlign: "center", padding: 10, fontSize: 13,
            color: "#999", fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", margin: 0,
          }}
        >
          This date doesn't work — keep watching
        </p>
      </div>
    </div>
  );
};

export default AlertDetailPage;
