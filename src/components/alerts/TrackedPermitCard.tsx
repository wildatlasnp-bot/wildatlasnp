import { useState, useRef, useCallback } from "react";
import { ChevronDown, Trash2, Link as LinkIcon } from "lucide-react";

// Photo imports
import yosemiteImg from "@/assets/permits/yosemite-halfdome.jpg";
import zionImg from "@/assets/permits/zion-narrows.jpg";
import grandCanyonImg from "@/assets/permits/grand-canyon-southrim.jpg";
import grandTetonImg from "@/assets/permits/grand-teton-lupine.jpg";
import glacierImg from "@/assets/permits/glacier-highline.jpg";
import rockyMountainImg from "@/assets/permits/rocky-mountain-trailridge.jpg";
import rainierImg from "@/assets/permits/rainier-campmuir.jpg";
import archesImg from "@/assets/permits/arches-delicatearch.jpg";

export const PARK_PHOTOS: Record<string, string> = {
  yosemite: yosemiteImg,
  zion: zionImg,
  "grand-canyon": grandCanyonImg,
  "grand-teton": grandTetonImg,
  glacier: glacierImg,
  "rocky-mountain": rockyMountainImg,
  rainier: rainierImg,
  arches: archesImg,
};

export interface TrackedPermit {
  id: string;
  parkId: string;
  parkLabel: string;
  permitName: string;
  oddsPercent: number;
  statusLabel: string;
  statusColor: string;
  dateLabel: string;
  daysLabel: string;
  // Expanded panel data
  mochiTip?: string;
  seasonWindow?: string;
  frequency?: string;
  frequencyColor?: string;
  avgWeeklyOdds?: string;
}

interface TrackedPermitCardProps {
  permit: TrackedPermit;
  onRemove?: (id: string) => void;
}

/* Small inline Mochi SVG — bear face silhouette */
const MochiIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="13" r="8" fill="var(--forest-m)" opacity="0.15" />
    <circle cx="12" cy="13" r="8" stroke="var(--forest-m)" strokeWidth="1.2" fill="none" />
    <circle cx="9.5" cy="11.5" r="1" fill="var(--forest-m)" />
    <circle cx="14.5" cy="11.5" r="1" fill="var(--forest-m)" />
    <ellipse cx="12" cy="14.5" rx="2" ry="1.5" stroke="var(--forest-m)" strokeWidth="0.8" fill="none" />
    <circle cx="7" cy="7" r="2.5" fill="var(--forest-m)" opacity="0.18" />
    <circle cx="7" cy="7" r="2.5" stroke="var(--forest-m)" strokeWidth="1" fill="none" />
    <circle cx="17" cy="7" r="2.5" fill="var(--forest-m)" opacity="0.18" />
    <circle cx="17" cy="7" r="2.5" stroke="var(--forest-m)" strokeWidth="1" fill="none" />
  </svg>
);

/* SMS chat-bubble icon */
const SmsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M8 10h.01M12 10h.01M16 10h.01" />
  </svg>
);

const INTER = "'Inter', sans-serif";
const PLAYFAIR = "'Playfair Display', serif";

const TrackedPermitCard = ({ permit, onRemove }: TrackedPermitCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const photo = PARK_PHOTOS[permit.parkId] ?? yosemiteImg;

  const handleToggleExpand = useCallback(() => {
    setExpanded((e) => !e);
  }, []);

  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  }, []);

  const handleConfirmRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
    onRemove?.(permit.id);
  }, [onRemove, permit.id]);

  const handleCancelRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  }, []);

  const mochiTip = permit.mochiTip ?? `${permit.permitName} permits tend to open mid-week. I'll alert you the moment one drops.`;
  const seasonWindow = permit.seasonWindow ?? permit.dateLabel;
  const frequency = permit.frequency ?? "Infrequent";
  const frequencyColor = permit.frequencyColor ?? "var(--ds-amber)";
  const avgWeeklyOdds = permit.avgWeeklyOdds ?? `${permit.oddsPercent}%`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleExpand}
        onKeyDown={(e) => e.key === "Enter" && handleToggleExpand()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="pc-card"
        style={{
          margin: "0 24px 14px",
          borderRadius: 18,
          overflow: "hidden",
          background: "var(--forest-deep)",
          cursor: "pointer",
          boxShadow: expanded
            ? "none"
            : hovered
              ? "0 4px 12px rgba(28,56,40,0.14), 0 10px 28px rgba(28,56,40,0.12)"
              : "0 2px 8px rgba(28,56,40,0.10), 0 8px 24px rgba(28,56,40,0.08)",
          border: expanded ? "1px solid var(--rule2)" : "1px solid transparent",
          transform: hovered && !expanded ? "translateY(-1px)" : "translateY(0)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        }}
      >
        {/* PHOTO ZONE */}
        <div className="pc-photo" style={{ height: 168, position: "relative", overflow: "hidden" }}>
          <img
            src={photo}
            alt={permit.permitName}
            loading="lazy"
            width={800}
            height={512}
            className="pc-img"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(0.6px) saturate(1.08) brightness(0.92)",
              transition: "transform 0.4s ease",
              transform: hovered ? "scale(1.015)" : "scale(1)",
            }}
          />
          <div
            className="pc-scrim"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(13,26,18,0.05) 0%, rgba(13,26,18,0) 25%, rgba(13,26,18,0.5) 62%, rgba(13,26,18,0.9) 100%)",
              zIndex: 1,
            }}
          />
          <span
            style={{
              position: "absolute", top: 14, left: 16, zIndex: 2,
              fontFamily: INTER, fontSize: 9.5, fontWeight: 500,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)", textShadow: "0 1px 6px rgba(0,0,0,0.7)",
            }}
          >
            {permit.parkLabel}
          </span>
          <span
            style={{
              position: "absolute", bottom: 14, left: 16, right: 88, zIndex: 2,
              fontFamily: PLAYFAIR, fontSize: 26, fontWeight: 500,
              color: "white", textShadow: "0 2px 0 rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.4)",
              lineHeight: 1.15,
            }}
          >
            {permit.permitName}
          </span>
          <div
            style={{
              position: "absolute", top: 14, right: 14, zIndex: 2,
              background: "rgba(255,255,255,0.13)", backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 99, padding: "6px 16px",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}
          >
            <span style={{ fontFamily: PLAYFAIR, fontSize: 18, fontWeight: 500, color: "white", lineHeight: 1.1 }}>
              {permit.oddsPercent}%
            </span>
            <span style={{ fontFamily: INTER, fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
              ODDS
            </span>
          </div>
        </div>

        {/* DATA STRIP */}
        <div
          style={{
            background: "var(--cream-d)",
            padding: "12px 16px 13px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="shrink-0 rounded-full" style={{ width: 5, height: 5, backgroundColor: permit.statusColor }} />
            <span style={{ fontFamily: INTER, fontSize: 11, color: permit.statusColor, fontWeight: 500 }}>
              {permit.statusLabel}
            </span>
            <span style={{ fontFamily: INTER, fontSize: 11, color: "var(--dim)" }}>
              · {permit.dateLabel} · {permit.daysLabel}
            </span>
          </div>
          <div className="flex items-center justify-center shrink-0" style={{ width: 36 }}>
            <ChevronDown
              size={14}
              style={{
                color: "var(--dim)",
                transition: "transform 0.2s ease",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </div>
        </div>

        {/* EXPANDED PANEL */}
        <div
          ref={panelRef}
          style={{
            maxHeight: expanded ? 500 : 0,
            overflow: "hidden",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            style={{
              background: "var(--cream-d)",
              padding: "13px 16px 4px",
              borderTop: "1px solid var(--rule)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MOCHI TIP BOX */}
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 13px",
                borderRadius: 10,
                background: "rgba(26,47,35,0.06)",
                boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.4)",
                marginBottom: 13,
              }}
            >
              <div className="shrink-0 mt-0.5">
                <MochiIcon size={18} />
              </div>
              <p style={{ fontFamily: INTER, fontSize: 12, fontWeight: 300, color: "var(--ink2)", lineHeight: 1.55 }}>
                {mochiTip.split(/(\b(?:mid-week|Tuesday|mornings|openings|cancellations|fast|popular)\b)/gi).map((part, i) => {
                  if (/^(mid-week|Tuesday|mornings|openings|cancellations|fast|popular)$/i.test(part)) {
                    return <strong key={i} style={{ fontWeight: 600, color: "var(--forest)" }}>{part}</strong>;
                  }
                  return part;
                })}
              </p>
            </div>

            {/* THREE DETAIL LINES */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 13 }}>
              <DetailLine label="Season window" value={seasonWindow} />
              <DetailLine label="Frequency" value={frequency} valueColor={frequencyColor} />
              <DetailLine label="Avg. weekly odds" value={avgWeeklyOdds} valueColor="var(--forest-m)" />
            </div>

            {/* SMS TOGGLE ZONE */}
            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 10 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    <SmsIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span style={{ fontFamily: INTER, fontSize: 13, fontWeight: 500, color: "var(--forest)", display: "block" }}>
                      SMS alerts
                    </span>
                    <span style={{ fontFamily: INTER, fontSize: 11, fontWeight: 300, color: "var(--ds-muted)", display: "block", marginTop: 2 }}>
                      {smsEnabled ? "You'll get a text when this permit opens" : "Get a text the instant this permit opens"}
                    </span>
                    <span style={{ fontFamily: INTER, fontSize: 10, fontWeight: 300, color: "var(--dim)", display: "block", marginTop: 4, lineHeight: 1.45 }}>
                      By enabling, you consent to receive texts from WildAtlas (up to 1 per opening). Msg & data rates may apply. Reply STOP to cancel.{" "}
                      <a
                        href="/privacy"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--forest-m)", textDecoration: "underline" }}
                      >
                        Privacy Policy
                      </a>
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex flex-col items-center shrink-0" style={{ marginTop: 2 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSmsEnabled((v) => !v);
                    }}
                    className="relative"
                    style={{
                      width: 44,
                      height: 26,
                      borderRadius: 13,
                      background: smsEnabled ? "var(--forest)" : "var(--cream-dd)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      padding: 0,
                    }}
                    aria-label={smsEnabled ? "Disable SMS alerts" : "Enable SMS alerts"}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: smsEnabled ? 21 : 3,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
                      }}
                    />
                  </button>
                  <span style={{ fontFamily: INTER, fontSize: 10, color: "var(--dim)", marginTop: 3 }}>
                    {smsEnabled ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>

            {/* REMOVE LINK */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, paddingBottom: 8 }}>
              <button
                onClick={handleRemoveClick}
                className="flex items-center gap-1.5"
                style={{
                  fontFamily: INTER, fontSize: 12, fontWeight: 500,
                  color: "rgba(198,40,40,0.7)", background: "none", border: "none",
                  cursor: "pointer", padding: "4px 0",
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION BOTTOM SHEET */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[999] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={handleCancelRemove}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
            style={{
              background: "var(--cream)",
              borderRadius: "18px 18px 0 0",
              padding: "24px 24px 32px",
              animation: "slide-up-sheet 0.25s ease-out",
            }}
          >
            <h3 style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
              Remove {permit.permitName}?
            </h3>
            <p style={{ fontFamily: INTER, fontSize: 13, fontWeight: 300, color: "var(--ds-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              You'll stop receiving alerts for this permit. You can always add it back later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelRemove}
                style={{
                  flex: 1, fontFamily: INTER, fontSize: 14, fontWeight: 500,
                  color: "var(--forest)", background: "rgba(26,47,35,0.08)",
                  border: "1px solid var(--rule2)", borderRadius: 12,
                  padding: "12px 0", cursor: "pointer",
                }}
              >
                Keep it
              </button>
              <button
                onClick={handleConfirmRemove}
                style={{
                  flex: 1, fontFamily: INTER, fontSize: 14, fontWeight: 500,
                  color: "white", background: "var(--ds-red)",
                  border: "none", borderRadius: 12,
                  padding: "12px 0", cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* Detail line sub-component */
const DetailLine = ({
  label,
  value,
  valueColor = "var(--ink2)",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <div className="flex items-center justify-between">
    <span style={{ fontFamily: INTER, fontSize: 11, color: "var(--ds-muted)" }}>{label}</span>
    <span style={{ fontFamily: INTER, fontSize: 12, fontWeight: 500, color: valueColor }}>{value}</span>
  </div>
);

export default TrackedPermitCard;
