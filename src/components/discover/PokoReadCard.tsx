// "Poko's read on today" — single-sentence AI-generated brief for the current park.
// Calls the park-brief edge function (cached 1h server-side per park-hour bucket).
// Strict zero-hallucination: brief is built from real signals only.
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// Modern Ranger tokens — keep local aliases for terse inline use,
// but resolved via the canonical CSS variables in :root (index.css).
const GOLD = "var(--ranger-gold)";
const FOREST = "var(--ranger-ink-warm)";
const MUTED = "var(--ranger-ink-muted)";

interface PokoReadCardProps {
  parkId: string;
  parkShortName: string;
  onAskPoko?: (query: string) => void;
}

const briefMemoryCache = new Map<string, { brief: string; ts: number }>();
const MEMORY_TTL_MS = 10 * 60_000; // 10 min in-memory cache on top of server's 1h

export default function PokoReadCard({ parkId, parkShortName, onAskPoko }: PokoReadCardProps) {
  const [brief, setBrief] = useState<string | null>(() => {
    const cached = briefMemoryCache.get(parkId);
    if (cached && Date.now() - cached.ts < MEMORY_TTL_MS) return cached.brief;
    return null;
  });
  const [loading, setLoading] = useState(!brief);
  const [error, setError] = useState<string | null>(null);
  const [streamedChars, setStreamedChars] = useState(brief?.length ?? 0);
  const streamRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = briefMemoryCache.get(parkId);
    if (cached && Date.now() - cached.ts < MEMORY_TTL_MS) {
      setBrief(cached.brief);
      setStreamedChars(cached.brief.length);
      setLoading(false);
      setError(null);
      return;
    }
    setBrief(null);
    setStreamedChars(0);
    setLoading(true);
    setError(null);

    supabase.functions
      .invoke("park-brief", { body: { parkId } })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError("Poko's read is briefly offline.");
          setLoading(false);
          return;
        }
        if (data?.brief) {
          briefMemoryCache.set(parkId, { brief: data.brief, ts: Date.now() });
          setBrief(data.brief);
          setLoading(false);
          // Stream-in animation: reveal one char per frame after first paint
          if (streamRef.current) cancelAnimationFrame(streamRef.current);
          let i = 0;
          const total = data.brief.length;
          const tick = () => {
            i = Math.min(total, i + 3); // 3 chars per frame ≈ pleasant speed
            setStreamedChars(i);
            if (i < total) streamRef.current = requestAnimationFrame(tick);
          };
          streamRef.current = requestAnimationFrame(tick);
        } else if (data?.error) {
          setError("Poko's read is briefly offline.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (streamRef.current) cancelAnimationFrame(streamRef.current);
    };
  }, [parkId]);

  const visibleBrief = brief ? brief.slice(0, streamedChars) : "";
  const isStreaming = brief !== null && streamedChars < brief.length;

  return (
    <div style={{ paddingTop: 16, paddingLeft: 20, paddingRight: 20 }}>
      <div
        style={{
          background: "#FAF7F2",
          border: `1px solid #ECE7DF`,
          borderLeft: `2px solid ${GOLD}`,
          borderRadius: 10,
          padding: "16px 18px 14px 18px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Tiny gold rule + eyebrow */}
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <span style={{ width: 16, height: 1, backgroundColor: GOLD, opacity: 0.65 }} />
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Poko's read · today
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", alignItems: "center", gap: 6, height: 22 }}
              aria-label="Poko is reading the park"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: GOLD,
                    opacity: 0.6,
                    animation: `pokoDot 1.2s cubic-bezier(0.4,0,0.2,1) ${i * 0.18}s infinite`,
                  }}
                />
              ))}
            </motion.div>
          )}

          {error && !loading && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 15,
                color: MUTED,
                lineHeight: 1.45,
              }}
            >
              {error}
            </motion.p>
          )}

          {brief && !loading && (
            <motion.p
              key="brief"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 17,
                fontWeight: 400,
                color: FOREST,
                lineHeight: 1.45,
                letterSpacing: "-0.005em",
                margin: 0,
                minHeight: 22,
              }}
            >
              {visibleBrief}
              {isStreaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    marginLeft: 2,
                    backgroundColor: GOLD,
                    verticalAlign: "middle",
                    animation: "pokoCaret 0.7s steps(1) infinite",
                  }}
                />
              )}
            </motion.p>
          )}
        </AnimatePresence>

        {brief && !loading && !isStreaming && onAskPoko && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.32, delay: 0.18 }}
            onClick={() =>
              onAskPoko(`What should I know about ${parkShortName} right now?`)
            }
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: 13,
              color: GOLD,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              marginTop: 10,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationColor: "rgba(201,169,110,0.4)",
              minHeight: 28,
            }}
          >
            Ask Poko →
          </motion.button>
        )}
      </div>
    </div>
  );
}
