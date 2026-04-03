import { useState } from "react";
import posthog from "@/lib/posthog";

const CONSENT_KEY = "wildatlas_analytics_consent";

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(CONSENT_KEY)
  );

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    posthog.opt_in_capturing();
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    posthog.opt_out_capturing();
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
      style={{
        background: "#F0EDEA",
        borderTop: "1px solid rgba(26,26,26,0.08)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "#1A1A1A",
          lineHeight: 1.4,
          margin: 0,
        }}
      >
        We use analytics to improve WildAtlas. No ads, ever.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleDecline}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#6B7280",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 12px",
          }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "#2F6F4E",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            padding: "6px 16px",
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
