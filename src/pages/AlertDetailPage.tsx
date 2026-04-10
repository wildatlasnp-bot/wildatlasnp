import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Zap, ExternalLink, ArrowLeft, Calendar, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRelativeTime } from "@/hooks/useRelativeTime";

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

const PULSE_KEYFRAMES = `
@keyframes amberPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
@keyframes zapPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

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
  const spotsCount = useMemo(() => parseTotalSpots(rawDates), [rawDates]);
  const elapsed = useElapsedTimer(detectedAt);

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
    } catch { /* fallback */ }
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
  const timerColor = elapsed.seconds >= 120 ? "#E24B4A" : "#888";

  // Build pills — only with real data
  const pills: { icon: "zap" | "calendar" | "ticket"; label: string }[] = [];
  pills.push({ icon: "zap", label: "Just detected" });
  if (dateDisplay) pills.push({ icon: "calendar", label: dateDisplay });
  if (spotsCount !== null) pills.push({ icon: "ticket", label: `${spotsCount} spot${spotsCount !== 1 ? "s" : ""}` });

  const PillIcon = ({ type }: { type: "zap" | "calendar" | "ticket" }) => {
    switch (type) {
      case "zap": return <Zap size={12} color="#fff" fill="#fff" />;
      case "calendar": return <Calendar size={12} color="#fff" />;
      case "ticket": return <Ticket size={12} color="#fff" />;
    }
  };

  return (
    <div
      className="flex flex-col"
      style={{ background: "#F0EDEA", minHeight: "100dvh", position: "relative" }}
    >
      <style>{PULSE_KEYFRAMES}</style>

      {/* Back nav — unchanged */}
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

      {/* Banner */}
      <div
        className="flex items-center gap-3"
        style={{
          background: "#1A2F1E",
          height: 64,
          padding: "0 20px",
          margin: "0 16px",
          borderRadius: 12,
        }}
      >
        <Zap size={18} color="#fff" fill="#fff" />
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22,
            fontWeight: 400,
            fontStyle: "italic",
            color: "#fff",
            letterSpacing: "0.01em",
          }}
        >
          Permit window open
        </span>
      </div>

      {/* Main content */}
      <div style={{ padding: "28px 20px 0" }}>
        {/* Park name */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 38,
            fontWeight: 600,
            color: "#1A2F1E",
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {parkName || "Permit Available"}
        </h1>

        {/* Permit type */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 400,
            color: "#888",
            margin: "8px 0 0",
          }}
        >
          {permitName || "Timed Entry Permit"}
        </p>

        {/* Amber dot + Act fast */}
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

        {/* Stats pills */}
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 20 }}>
          {pills.map((pill) => (
            <div
              key={pill.label}
              className="flex items-center"
              style={{
                background: "#1A2F1E",
                borderRadius: 20,
                padding: "6px 14px",
                gap: 6,
              }}
            >
              <PillIcon type={pill.icon} />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                }}
              >
                {pill.label}
              </span>
            </div>
          ))}
        </div>

        {/* Urgency bar */}
        <div
          style={{
            marginTop: 16,
            background: "#FFF8EC",
            borderLeft: "4px solid #C9A96E",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              fontStyle: "normal",
              color: "#7A5C1E",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            These permits vanish in minutes — most are gone within 2–5 min of release.
          </p>
        </div>

        {/* Live timer */}
        <div
          className="flex items-center justify-center"
          style={{ marginTop: 12, gap: 5 }}
        >
          <Zap size={12} color={timerColor} />
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: timerColor,
              transition: "color 0.3s ease",
            }}
          >
            {elapsed.display} since detection
          </span>
        </div>
      </div>

      {/* Bottom CTA area — pinned */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#F0EDEA",
          padding: "0 20px max(env(safe-area-inset-bottom, 0px), 20px)",
        }}
      >
        {/* Hairline divider */}
        <div style={{ height: 0.5, background: "rgba(0,0,0,0.1)", marginBottom: 16 }} />

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

        {/* Secondary actions */}
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
