import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, MapPin, Bell, Sparkles } from "lucide-react";
import { useProStatus } from "@/hooks/useProStatus";

const perkIcons: Record<string, React.ComponentType<any>> = {
  "Scan frequency": Radio,
  "Parks monitored": MapPin,
  "Alert delivery": Bell,
  "Poko AI": Sparkles,
};

const perks = [
  { label: "Scan frequency", value: "Every 2 minutes" },
  { label: "Parks monitored", value: "All 8 parks" },
  { label: "Alert delivery", value: "SMS + Push" },
  { label: "Poko AI", value: "Unlimited messages" },
];

// Static SVG stars (treeline backdrop)
const svgStars = [
  { cx: 28, cy: 18, r: 0.8, fill: "#F7F4EF", opacity: 0.4 },
  { cx: 72, cy: 32, r: 1.0, fill: "#C9A96E", opacity: 0.35 },
  { cx: 140, cy: 14, r: 0.7, fill: "#F7F4EF", opacity: 0.5 },
  { cx: 195, cy: 42, r: 1.1, fill: "#F7F4EF", opacity: 0.3 },
  { cx: 230, cy: 16, r: 0.8, fill: "#C9A96E", opacity: 0.45 },
  { cx: 268, cy: 52, r: 0.9, fill: "#F7F4EF", opacity: 0.25 },
  { cx: 310, cy: 22, r: 1.2, fill: "#F7F4EF", opacity: 0.4 },
  { cx: 48, cy: 55, r: 0.7, fill: "#C9A96E", opacity: 0.3 },
  { cx: 112, cy: 48, r: 1.0, fill: "#F7F4EF", opacity: 0.6 },
  { cx: 175, cy: 28, r: 0.8, fill: "#C9A96E", opacity: 0.5 },
  { cx: 290, cy: 38, r: 0.7, fill: "#F7F4EF", opacity: 0.35 },
  { cx: 340, cy: 48, r: 0.9, fill: "#C9A96E", opacity: 0.25 },
  { cx: 88, cy: 8, r: 1.1, fill: "#F7F4EF", opacity: 0.45 },
  { cx: 250, cy: 8, r: 0.7, fill: "#F7F4EF", opacity: 0.55 },
  { cx: 155, cy: 62, r: 0.8, fill: "#C9A96E", opacity: 0.4 },
];

// Animated pulsing star dots (CSS-driven)
const animStars = [
  { x: "8%", y: "12%", size: 2.0, delay: 0 },
  { x: "22%", y: "28%", size: 1.6, delay: 1.2 },
  { x: "35%", y: "8%", size: 2.2, delay: 2.8 },
  { x: "48%", y: "35%", size: 1.8, delay: 0.6 },
  { x: "58%", y: "15%", size: 2.4, delay: 3.4 },
  { x: "70%", y: "30%", size: 1.5, delay: 1.8 },
  { x: "82%", y: "10%", size: 2.0, delay: 4.1 },
  { x: "15%", y: "42%", size: 1.7, delay: 2.2 },
  { x: "42%", y: "22%", size: 2.1, delay: 0.3 },
  { x: "62%", y: "45%", size: 1.6, delay: 3.0 },
  { x: "90%", y: "20%", size: 2.3, delay: 1.5 },
  { x: "28%", y: "50%", size: 1.8, delay: 4.6 },
  { x: "75%", y: "42%", size: 2.0, delay: 2.5 },
  { x: "50%", y: "5%", size: 1.5, delay: 5.0 },
];

const starPulseKeyframes = `
@keyframes starPulse {
  0%, 100% { opacity: 0; }
  40%, 60% { opacity: 1; }
}
@keyframes shootingStar {
  0% { transform: translateX(-120px); opacity: 0; }
  5% { opacity: 1; }
  30% { opacity: 1; }
  35% { transform: translateX(500px); opacity: 0; }
  100% { opacity: 0; }
}
`;

// C5-E5-G5-C6 chime
function playChime() {
  try {
    const ac = new AudioContext();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.12, ac.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.8);
      osc.connect(gain).connect(ac.destination);
      osc.start(ac.currentTime + i * 0.12);
      osc.stop(ac.currentTime + i * 0.12 + 0.8);
    });
  } catch {}
}

const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const { isPro, refreshProStatus } = useProStatus();
  const [timedOut, setTimedOut] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isPro && !celebrated) {
      setCelebrated(true);
      playChime();
    }
  }, [isPro, celebrated]);

  useEffect(() => {
    if (isPro) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTimedOut(false);
      return;
    }
    pollingRef.current = setInterval(() => refreshProStatus(), 3000);
    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setTimedOut(true);
    }, 15000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPro]);

  const showWaiting = !isPro && !timedOut;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#E8E4DE",
        padding: "24px 16px",
      }}
    >
      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 24,
          overflow: "hidden",
          background: "#F7F4EF",
        }}
      >
        {/* Hero */}
        <div
          style={{
            position: "relative",
            height: 240,
            background: "#1A2F1E",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "visible",
          }}
          >
          {/* Shooting star */}
          <div
            style={{
              position: "absolute",
              top: "25%",
              left: 0,
              width: "100%",
              height: 0,
              transform: "rotate(35deg)",
              transformOrigin: "0% 0%",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 60,
                height: 2,
                borderRadius: 1,
                background: "linear-gradient(90deg, transparent, rgba(244,240,232,0.9))",
                opacity: 0,
                animation: "shootingStar 6s linear infinite",
              }}
            />
          </div>

          <style dangerouslySetInnerHTML={{ __html: starPulseKeyframes }} />
          {animStars.map((s, i) => (
            <div
              key={`anim-star-${i}`}
              style={{
                position: "absolute",
                left: s.x,
                top: s.y,
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                background: "rgba(244,240,232,0.6)",
                opacity: 0,
                animation: `starPulse ${3 + (i % 4) * 0.8}s ease-in-out ${s.delay}s infinite`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          ))}

          {/* Static star field + treeline SVG */}
          <svg
            viewBox="0 0 360 240"
            fill="none"
            preserveAspectRatio="xMidYMax slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {/* Stars */}
            {svgStars.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.opacity} />
            ))}

            {/* Treeline — layered rows back to front */}
            {/* Row 4 (farthest, darkest, tallest center) */}
            <polygon points="100,170 108,130 116,170" fill="#0e1a10" />
            <polygon points="140,170 150,115 160,170" fill="#0e1a10" />
            <polygon points="175,170 185,108 195,170" fill="#0e1a10" />
            <polygon points="210,170 218,120 226,170" fill="#0e1a10" />
            <polygon points="245,170 252,135 259,170" fill="#0e1a10" />

            {/* Row 3 */}
            <polygon points="60,185 70,148 80,185" fill="#122216" />
            <polygon points="115,185 126,138 137,185" fill="#122216" />
            <polygon points="160,185 172,125 184,185" fill="#122216" />
            <polygon points="200,185 210,132 220,185" fill="#122216" />
            <polygon points="250,185 258,145 266,185" fill="#122216" />
            <polygon points="285,185 292,155 299,185" fill="#122216" />

            {/* Row 2 */}
            <polygon points="30,200 40,165 50,200" fill="#153020" />
            <polygon points="80,200 92,155 104,200" fill="#153020" />
            <polygon points="135,200 148,142 161,200" fill="#153020" />
            <polygon points="185,200 196,148 207,200" fill="#153020" />
            <polygon points="230,200 240,158 250,200" fill="#153020" />
            <polygon points="275,200 284,168 293,200" fill="#153020" />
            <polygon points="310,200 318,172 326,200" fill="#153020" />

            {/* Row 1 (nearest, lightest) */}
            <polygon points="10,215 22,178 34,215" fill="#1a3a22" />
            <polygon points="55,215 68,172 81,215" fill="#1a3a22" />
            <polygon points="105,215 118,165 131,215" fill="#1a3a22" />
            <polygon points="155,215 170,158 185,215" fill="#1a3a22" />
            <polygon points="205,215 218,168 231,215" fill="#1a3a22" />
            <polygon points="255,215 266,175 277,215" fill="#1a3a22" />
            <polygon points="300,215 312,180 324,215" fill="#1a3a22" />
            <polygon points="340,215 348,185 356,215" fill="#1a3a22" />

            {/* Ground cap */}
            <rect x="0" y="210" width="360" height="30" fill="#0e1a10" />
          </svg>

          {/* Text overlay */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#C9A96E",
                marginBottom: 12,
              }}
            >
              WildAtlas Pro — Activated
            </div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 48,
                fontWeight: 300,
                color: "#F7F4EF",
                letterSpacing: -1,
                margin: 0,
                lineHeight: 1,
              }}
            >
              You're in.
            </h1>
          </div>

          {/* Poko jumping celebration */}
          <img
            src="/poko-jumping.png"
            alt="Poko celebrating"
            style={{
              position: "absolute",
              bottom: -44,
              left: "50%",
              transform: "translateX(-50%)",
              width: 100,
              height: 100,
              objectFit: "contain",
              zIndex: 10,
              background: "transparent",
              mixBlendMode: "normal",
            }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: "2rem 1.75rem 1.75rem" }}>
          {/* Amber divider */}
          <div style={{ width: 32, height: 1, background: "#C9A96E", marginBottom: "1.5rem" }} />

          {/* Subtext */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 300,
              color: "#5a5a4a",
              lineHeight: 1.7,
              margin: "0 0 1.5rem",
            }}
          >
            Poko's watching the permits. The moment something opens, you'll know — before anyone else does.
          </p>

          {/* Perk list */}
          <div style={{ marginBottom: 24 }}>
            {perks.map((perk, i) => (
              <div
                key={perk.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 0",
                  lineHeight: 2.2,
                  borderBottom: i < perks.length - 1 ? "0.5px solid rgba(47,111,78,0.12)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: "#2a2a1e",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {(() => { const Icon = perkIcons[perk.label]; return Icon ? <Icon size={14} color="rgba(201,169,110,0.6)" strokeWidth={2} /> : null; })()}
                  {perk.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 15,
                    fontWeight: 500,
                    color: perk.label === "Scan frequency" ? "#C9A96E" : "#2F6F4E",
                  }}
                >
                  {perk.value}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate("/app?tab=sniper")}
            style={{
              width: "100%",
              background: "#2F6F4E",
              color: "#F7F4EF",
              borderRadius: 10,
              padding: 15,
              border: "none",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "0.04em",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.15), transparent 70%), #265E41")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2F6F4E")}
          >
            Start watching permits →
          </button>

          {/* Footer */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              color: "#aaa",
              textAlign: "center",
              marginTop: 20,
            }}
          >
            Payment confirmed — check your email for a receipt.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;
