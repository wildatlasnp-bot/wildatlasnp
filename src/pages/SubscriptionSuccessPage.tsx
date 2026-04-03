import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { useProStatus } from "@/hooks/useProStatus";
import mochiImg from "@/assets/mochi-wave-transparent.png";

const benefits = [
  { label: "2-min scans", sub: "Faster than anyone" },
  { label: "Unlimited parks", sub: "Track them all" },
  { label: "SMS alerts", sub: "Never miss a drop" },
];

// Lightweight canvas confetti burst
function fireConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 2;
  const cw = canvas.offsetWidth;
  const ch = canvas.offsetHeight;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  ctx.scale(dpr, dpr);
  const colors = ["#2F6F4E", "#4A9B70", "#F5C542", "#E87461", "#5BB5E0", "#AB7FE6"];
  const pieces: { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; shape: number }[] = [];
  const cx = cw / 2;
  const cy = ch / 2;
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 2,
      r: Math.random() * 5 + 3,
      c: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      shape: Math.floor(Math.random() * 3),
    });
  }
  let frame = 0;
  const maxFrames = 90;
  const tick = () => {
    if (frame++ > maxFrames) return;
    ctx.clearRect(0, 0, cw, ch);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.vx *= 0.99;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - frame / maxFrames);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      if (p.shape === 0) {
        ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2);
      } else if (p.shape === 1) {
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// C5-E5-G5-C6 chime
function playChime() {
  try {
    const ac = new AudioContext();
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Celebration when isPro flips true
  useEffect(() => {
    if (isPro && !celebrated) {
      setCelebrated(true);
      playChime();
      if (canvasRef.current) fireConfetti(canvasRef.current);
    }
  }, [isPro, celebrated]);

  useEffect(() => {
    if (isPro) {
      // Pro confirmed — clear everything, ensure no fallback shows
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTimedOut(false);
      return;
    }

    pollingRef.current = setInterval(() => { refreshProStatus(); }, 3000);

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
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#F0EDEA", position: "relative", overflow: "hidden" }}
    >
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full"
        style={{ zIndex: 10 }}
      />
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
