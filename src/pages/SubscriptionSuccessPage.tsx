import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { useProStatus } from "@/hooks/useProStatus";
import mochiImg from "@/assets/mochi-wave-transparent.png";

const benefits = [
  { label: "2-min scans", sub: "Faster than anyone" },
  { label: "Unlimited parks", sub: "Track them all" },
  { label: "SMS alerts", sub: "Never miss a drop" },
];

const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const { isPro, refreshProStatus } = useProStatus();
  const [timedOut, setTimedOut] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isPro) return;

    // Poll every 3s for pro status
    pollingRef.current = setInterval(() => { refreshProStatus(); }, 3000);

    // After 15s, stop polling and show fallback
    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setTimedOut(true);
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPro]);

  // Show waiting state only if not Pro and not timed out
  const showWaiting = !isPro && !timedOut;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#F0EDEA" }}
    >
      {/* Mochi */}
      <img
        src={mochiImg}
        alt="Poko mascot"
        className="animate-[mochi-enter_0.6s_ease-out_both]"
        style={{ width: 96 }}
      />

      {/* Heading */}
      <h1
        className="font-heading"
        style={{ fontSize: 32, fontWeight: 300, color: "#1a1a1a", marginTop: 20 }}
      >
        You're in.
      </h1>

      {/* Subheading */}
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          color: "#6B6B6B",
          lineHeight: 1.4,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        Welcome to WildAtlas Pro. Poko's already on the trail.
      </p>

      {/* Benefits */}
      <div
        className="flex flex-row gap-6 justify-center items-start max-[400px]:flex-col max-[400px]:items-center max-[400px]:gap-4"
        style={{ marginTop: 32 }}
      >
        {benefits.map((b) => (
          <div key={b.label} className="flex flex-col items-center text-center">
            <CheckCircle size={18} style={{ color: "#2F6F4E" }} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "#1a1a1a",
                marginTop: 6,
              }}
            >
              {b.label}
            </span>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: "#6B6B6B",
                marginTop: 2,
              }}
            >
              {b.sub}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate("/app?tab=sniper")}
        className="tactile-button"
        style={{
          width: "100%",
          maxWidth: 360,
          height: 52,
          background: "#2F6F4E",
          color: "#fff",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          borderRadius: 12,
          border: "none",
          marginTop: 40,
          cursor: "pointer",
          transition: "background 0.15s ease, transform 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#265E41")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#2F6F4E")}
      >
        Start watching permits →
      </button>

      {/* Webhook-delayed fallback */}
      {timedOut && !isPro && (
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#6B7280",
            textAlign: "center",
            marginTop: 16,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          Your payment was received — Pro features are activating. If they don't appear within a few minutes, contact support at{" "}
          <a href="mailto:support@wildatlas.app" className="underline">support@wildatlas.app</a>
        </p>
      )}

      {/* Waiting spinner */}
      {showWaiting && (
        <div className="flex items-center gap-1.5 mt-4" style={{ color: "#6B7280", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
          <Loader2 size={12} className="animate-spin" /> Activating Pro…
        </div>
      )}

      {/* Microcopy */}
      {isPro && (
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#9B9B9B",
            textAlign: "center",
            marginTop: 12,
            maxWidth: 360,
          }}
        >
          Your Pro access is active. Check Settings if it takes a moment to reflect.
        </p>
      )}
    </div>
  );
};

export default SubscriptionSuccessPage;
