import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Zap, ExternalLink, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";

/* ── helpers ── */

function parseFirstDateRange(rawDates: string): string {
  if (!rawDates) return "Not specified";
  const parts = rawDates.split(",").map((d) => d.trim()).filter(Boolean);
  if (parts.length === 0) return "Not specified";
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
  // collapse "Jul 14" – "Jul 16" → "Jul 14–16"
  const [m1] = first.split(" ");
  const [m2, d2] = last.split(" ");
  if (m1 === m2) return `${first}–${d2}`;
  return `${first} – ${last}`;
}

function parseTotalSpots(rawDates: string): string {
  if (!rawDates) return "—";
  const parts = rawDates.split(",").map((d) => d.trim()).filter(Boolean);
  let total = 0;
  let hasSpots = false;
  for (const p of parts) {
    const [, spotsStr] = p.split(":");
    if (spotsStr) {
      const n = parseInt(spotsStr, 10);
      if (!isNaN(n)) { total += n; hasSpots = true; }
    }
  }
  return hasSpots ? String(total) : "—";
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "just now";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function resolveParkName(parkParam: string, parkId?: string): string {
  if (parkParam) return parkParam;
  if (parkId && PARKS[parkId]) return PARKS[parkId].name;
  return "";
}

/* ── component ── */

const AlertDetailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const permitName = params.get("permit") ?? "Permit";
  const parkName = resolveParkName(params.get("park") ?? "", params.get("pid") ?? "");
  const rawDates = params.get("dates") ?? "";
  const bookingUrl = params.get("url") ?? "https://www.recreation.gov";
  const watchId = params.get("wid") ?? "";
  const detectedAt = params.get("detected") ?? null;

  const dateDisplay = useMemo(() => parseFirstDateRange(rawDates), [rawDates]);
  const spotsDisplay = useMemo(() => parseTotalSpots(rawDates), [rawDates]);
  const timeDisplay = useMemo(() => relativeTime(detectedAt), [detectedAt]);

  const [captured, setCaptured] = useState(false);

  const handleBook = () => {
    const FALLBACK_URL = "https://www.recreation.gov";
    let targetUrl = FALLBACK_URL;
    try {
      const parsed = new URL(bookingUrl);
      if (
        parsed.protocol === "https:" &&
        (parsed.hostname === "recreation.gov" || parsed.hostname === "www.recreation.gov")
      ) {
        targetUrl = bookingUrl;
      }
    } catch {
      /* malformed URL — use fallback */
    }
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

  /* pulse animation for the amber dot */
  const [pulseOpacity, setPulseOpacity] = useState(1);
  useEffect(() => {
    let raf: number;
    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      const o = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      setPulseOpacity(o);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hasDeepLink = bookingUrl.includes("/permits/");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F0EDEA" }}>
      {/* Back nav */}
      <div style={{ padding: "14px 16px 8px" }}>
        <button
          onClick={() => navigate("/app?tab=sniper")}
          className="flex items-center gap-1.5"
          style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#888", cursor: "pointer" }}
        >
          <ArrowLeft size={15} />
          Back to Alerts
        </button>
      </div>

      {/* 1. HEADER BAR */}
      <div
        className="flex items-center gap-3"
        style={{
          background: "#2F6F4E",
          padding: "18px 20px",
          margin: "0 16px",
          borderRadius: 16,
        }}
      >
        <Zap size={22} color="#fff" fill="#fff" />
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: "0.01em",
          }}
        >
          Availability Detected
        </span>
      </div>

      {/* 2. HERO BLOCK */}
      <div style={{ padding: "24px 20px 16px" }}>
        {parkName && (
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "#2F6F4E",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {parkName}
          </p>
        )}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            fontWeight: 500,
            color: "#1a1a1a",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {permitName}
        </h1>

        {/* Amber urgency indicator */}
        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#BA7517",
              opacity: pulseOpacity,
              transition: "opacity 80ms linear",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#BA7517",
            }}
          >
            Act fast — permits go quickly
          </span>
        </div>
      </div>

      {/* 3. DATA STRIP */}
      <div
        style={{
          background: "#EAE5DF",
          margin: "0 16px",
          borderRadius: 12,
          padding: "16px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
        {[
          { label: "DATE", value: dateDisplay, bold: false },
          { label: "SPOTS", value: spotsDisplay, bold: false },
          { label: "DETECTED", value: timeDisplay, bold: true },
        ].map((col) => (
          <div key={col.label} style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: "#888",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: 0,
                marginBottom: 4,
              }}
            >
              {col.label}
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: col.bold ? 16 : 15,
                fontWeight: col.bold ? 500 : 400,
                color: col.bold ? "#1a1a1a" : "#333",
                margin: 0,
              }}
            >
              {col.value}
            </p>
          </div>
        ))}
      </div>

      {/* 4. GUIDANCE LINE */}
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 15,
          fontStyle: "italic",
          color: "#555",
          padding: "20px 20px",
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        Permits at this level typically disappear within minutes of release.
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* 5. ACTION AREA */}
      <div style={{ padding: "0 20px 28px" }}>
        {/* Primary CTA */}
        <button
          onClick={handleBook}
          className="flex items-center justify-center gap-2"
          style={{
            width: "100%",
            height: 52,
            background: "#2F6F4E",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(47,111,78,0.25)",
          }}
        >
          <ExternalLink size={16} />
          Claim on Recreation.gov →
        </button>

        <p
          style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#999",
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          {!hasDeepLink
            ? "Opens Recreation.gov — select your dates from the calendar."
            : "Opens Recreation.gov — confirm and complete your booking."}
        </p>

        {/* Mark as captured */}
        {!captured && (
          <button
            onClick={handleCapture}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "#555",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
            }}
          >
            I already booked it — mark as captured
          </button>
        )}

        {/* Keep watching */}
        <button
          onClick={() => navigate("/app?tab=sniper")}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: "#999",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 0",
          }}
        >
          This date doesn't work — keep watching
        </button>

        {/* Upgrade nudge — kept as-is */}
        <div style={{ borderTop: "1px solid #ddd", marginTop: 14, paddingTop: 14 }}>
          <p
            style={{
              textAlign: "center",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(0,0,0,0.4)",
              lineHeight: 1.5,
            }}
          >
            Want faster scans and multi-park tracking?{" "}
            <button
              onClick={() => navigate("/app?tab=sniper&upgrade=1")}
              style={{
                background: "none",
                border: "none",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "#2F6F4E",
                cursor: "pointer",
                padding: 0,
                textDecoration: "none",
              }}
            >
              Upgrade to Pro
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlertDetailPage;
