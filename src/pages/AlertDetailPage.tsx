import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Zap, ExternalLink, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";

const PULSE_KEYFRAMES = `
@keyframes amberPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

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
  const [m2, d2] = last.split(" ");
  if (m1 === m2) return `${first}–${d2}`;
  return `${first} – ${last}`;
}

function parseTotalSpots(rawDates: string): number | null {
  if (!rawDates) return null;
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
  return hasSpots ? total : null;
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

const AlertDetailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const permitName = resolvePermitName(params);
  const parkName = resolveParkName(
    params.get("park") ?? "",
    params.get("pid") ?? params.get("park_id") ?? ""
  );
  const rawDates = params.get("dates") ?? "";
  const bookingUrl = params.get("url") ?? "https://www.recreation.gov";
  const watchId = params.get("wid") ?? "";
  const detectedAt = params.get("detected") ?? null;

  const dateDisplay = useMemo(() => parseFirstDateRange(rawDates), [rawDates]);
  const spotsCount = useMemo(() => parseTotalSpots(rawDates), [rawDates]);
  const timeDisplay = useMemo(() => relativeTime(detectedAt), [detectedAt]);

  const [captured, setCaptured] = useState(false);
  const [showUpgradeNudge, setShowUpgradeNudge] = useState(false);

  const triggerNudge = () => {
    setTimeout(() => setShowUpgradeNudge(true), 400);
  };

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
      /* malformed — use fallback */
    }
    window.open(targetUrl, "_blank", "noopener");
  };

  const handleCapture = async () => {
    setCaptured(true);
    triggerNudge();
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

  const hasDeepLink = bookingUrl.includes("/permits/");

  // Build data columns dynamically — only real data
  const dataColumns: { label: string; value: string; bold?: boolean }[] = [];
  if (dateDisplay) dataColumns.push({ label: "DATE", value: dateDisplay });
  if (spotsCount !== null) dataColumns.push({ label: "SPOTS", value: String(spotsCount) });
  dataColumns.push({ label: "DETECTED", value: timeDisplay, bold: true });

  const hasAnyDateOrSpots = dateDisplay !== null || spotsCount !== null;

  // Heading: park name + permit type, or fallback
  const headingPrimary = parkName || (permitName ? "Permit Available" : "Permit Available");
  const headingSecondary = parkName && permitName ? permitName : (parkName ? "" : permitName);

  return (
    <div
      className="flex flex-col"
      style={{ background: "#F0EDEA", minHeight: "100dvh", position: "relative" }}
    >
      <style>{PULSE_KEYFRAMES}</style>

      {/* Back nav */}
      <div style={{ padding: "14px 16px 8px" }}>
        <button
          onClick={() => navigate("/app?tab=sniper")}
          className="flex items-center gap-1.5"
          style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#888", cursor: "pointer", background: "none", border: "none" }}
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
          Permit window open
        </span>
      </div>

      {/* 2. HERO BLOCK */}
      <div style={{ padding: "32px 20px 16px" }}>
        {parkName ? (
          <>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 32,
                fontWeight: 600,
                color: "#1a1a1a",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {parkName}
            </h1>
            {permitName && (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  color: "#888",
                  marginTop: 6,
                  margin: "6px 0 0",
                }}
              >
                {permitName}
              </p>
            )}
          </>
        ) : (
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 32,
              fontWeight: 600,
              color: "#1a1a1a",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {permitName || "Permit Available"}
          </h1>
        )}

        {/* Amber urgency indicator */}
        <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#BA7517",
              animation: "amberPulse 2s ease-in-out infinite",
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

      {/* 3. DATA STRIP — only real data */}
      {hasAnyDateOrSpots ? (
        <div
          style={{
            background: "#EAE5DF",
            margin: "0 16px",
            borderRadius: 12,
            padding: "16px 0",
            display: "grid",
            gridTemplateColumns: `repeat(${dataColumns.length}, 1fr)`,
          }}
        >
          {dataColumns.map((col) => (
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
      ) : (
        <div
          style={{
            margin: "0 16px",
            background: "#EAE5DF",
            borderRadius: 12,
            padding: "14px 20px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "#333",
              margin: 0,
            }}
          >
            Available now · Detected {timeDisplay}
          </p>
        </div>
      )}

      {/* 4. WHAT TO DO — instructional steps */}
      <div style={{ padding: "20px 20px 0" }}>
        <div className="flex flex-col gap-1.5">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: 0 }}>
            <span style={{ fontWeight: 500, color: "#666" }}>1.</span> Tap <strong style={{ fontWeight: 500, color: "#555" }}>Claim</strong> below
          </p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: 0 }}>
            <span style={{ fontWeight: 500, color: "#666" }}>2.</span> Select your dates on Recreation.gov
          </p>
        </div>
      </div>

      {/* 5. URGENCY BAR */}
      <div
        style={{
          margin: "16px 16px 0",
          background: "rgba(201,169,110,0.15)",
          borderLeft: "3px solid #C9A96E",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: "#1a1a1a",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Permits at this level typically disappear within minutes of release.
        </p>
      </div>

      {/* 6. ACTION AREA — pinned to bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#F0EDEA",
          padding: "16px 20px max(env(safe-area-inset-bottom, 0px), 20px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
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
            marginBottom: 0,
          }}
        >
          {!hasDeepLink
            ? "Opens Recreation.gov — select your dates from the calendar."
            : "Opens Recreation.gov — confirm and complete your booking."}
        </p>

        {/* Secondary actions with 8px gaps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {!captured && (
            <button
              onClick={handleCapture}
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 400,
                color: "#2F6F4E",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              I already booked it — mark as captured
            </button>
          )}

          <button
            onClick={() => { triggerNudge(); navigate("/app?tab=sniper"); }}
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
              padding: "4px 0",
            }}
          >
            This date doesn't work — keep watching
          </button>
        </div>

        {/* Upgrade nudge */}
        {showUpgradeNudge && (
          <div style={{ borderTop: "1px solid #ddd", marginTop: 10, paddingTop: 10 }}>
            <p
              style={{
                textAlign: "center",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: "rgba(0,0,0,0.4)",
                lineHeight: 1.5,
                margin: 0,
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
                }}
              >
                Upgrade to Pro
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDetailPage;
