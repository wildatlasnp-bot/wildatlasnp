/**
 * SavedSignalsSection — "User intel" surface on the Discover tab.
 * Renders the captures the user has flown in from the Poko chat,
 * styled like Ranger Notes (serif, ranger-card surface) but
 * stamped "User-captured · Ns ago" so they're clearly distinct
 * from official park guidance.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  readSignals,
  removeSignal,
  subscribeSavedSignals,
  type SavedSignal,
} from "@/lib/saved-signals";
import { useAuth } from "@/contexts/AuthContext";
import { haptics } from "@/lib/haptics";

interface SavedSignalsSectionProps {
  parkId: string;
}

const formatRelative = (ts: number): string => {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const stripMarkdown = (s: string): string =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "• ")
    .replace(/\s+\n/g, "\n")
    .trim();

export default function SavedSignalsSection({ parkId }: SavedSignalsSectionProps) {
  const { user } = useAuth();
  const userKey = user?.id ?? "guest";
  const [items, setItems] = useState<SavedSignal[]>([]);

  useEffect(() => {
    const refresh = () => {
      setItems(readSignals(userKey).filter((s) => s.parkId === parkId));
    };
    refresh();
    return subscribeSavedSignals(refresh);
  }, [userKey, parkId]);

  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((s) => (
        <article
          key={s.id}
          className="ranger-card ranger-card--warm"
          style={{ position: "relative" }}
        >
          {/* Header — eyebrow + timestamp + remove */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--ranger-gold, #C9A96E)",
              }}
            >
              User-captured
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily:
                  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: 11,
                color: "var(--ranger-ink-muted, #6B7368)",
              }}
            >
              {formatRelative(s.capturedAt)}
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  removeSignal(userKey, s.id);
                }}
                aria-label="Remove this saved signal"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: "transparent",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ranger-ink-muted, #6B7368)",
                  cursor: "pointer",
                }}
              >
                <X size={14} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </span>
          </div>

          {/* Body — same serif feel as Ranger Notes */}
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--ranger-ink-body, #2A2F2A)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {stripMarkdown(s.text)}
          </p>
        </article>
      ))}
    </div>
  );
}
