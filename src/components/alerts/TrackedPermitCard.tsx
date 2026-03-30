import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
}

interface TrackedPermitCardProps {
  permit: TrackedPermit;
}

const TrackedPermitCard = ({ permit }: TrackedPermitCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const photo = PARK_PHOTOS[permit.parkId] ?? yosemiteImg;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((e) => !e)}
      onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
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

        {/* Gradient scrim */}
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

        {/* Park label */}
        <span
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            zIndex: 2,
            fontFamily: "'Inter', sans-serif",
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            textShadow: "0 1px 6px rgba(0,0,0,0.7)",
          }}
        >
          {permit.parkLabel}
        </span>

        {/* Permit name */}
        <span
          style={{
            position: "absolute",
            bottom: 14,
            left: 16,
            right: 88,
            zIndex: 2,
            fontFamily: "'Playfair Display', serif",
            fontSize: 26,
            fontWeight: 500,
            color: "white",
            textShadow: "0 2px 0 rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.4)",
            lineHeight: 1.15,
          }}
        >
          {permit.permitName}
        </span>

        {/* Frosted odds pill */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            background: "rgba(255,255,255,0.13)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 99,
            padding: "6px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 500,
              color: "white",
              lineHeight: 1.1,
            }}
          >
            {permit.oddsPercent}%
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
              marginTop: 1,
            }}
          >
            ODDS
          </span>
        </div>
      </div>

      {/* DATA STRIP */}
      <div
        style={{
          background: "var(--cream-d)",
          padding: "12px 16px 13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="shrink-0 rounded-full"
            style={{
              width: 5,
              height: 5,
              backgroundColor: permit.statusColor,
            }}
          />
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              color: permit.statusColor,
              fontWeight: 500,
            }}
          >
            {permit.statusLabel}
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              color: "var(--dim)",
            }}
          >
            · {permit.dateLabel} · {permit.daysLabel}
          </span>
        </div>
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 36 }}
        >
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
    </div>
  );
};

export default TrackedPermitCard;
