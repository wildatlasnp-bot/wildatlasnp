import { ChevronDown, Mountain } from "lucide-react";
import { PARKS, type ParkConfig } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface Props {
  activeParkId: string;
  onParkChange: (parkId: string) => void;
  variant?: "default" | "overlay";
  dropdownRelative?: boolean;
  watchedParkIds?: Set<string>;
}

const parkList = Object.values(PARKS);

const PARK_SUBLABELS: Record<string, string> = {
  zion: "Zion Canyon Shuttle",
  yosemite: "Half Dome · Wilderness",
  grand_teton: "Jenny Lake",
  glacier: "Logan Pass",
  rocky_mountain: "Bear Lake Corridor",
  rainier: "Paradise",
  arches: "Delicate Arch Trailhead",
  grand_canyon: "South Rim",
};

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ParkSelector = ({ activeParkId, onParkChange, variant = "default", dropdownRelative = false, watchedParkIds }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = PARKS[activeParkId];
  const parkColor = active?.primaryColor ?? "#2F6F4E";

  const isOverlay = variant === "overlay";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Convert hex to rgba for 0.15 opacity background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wider transition-colors font-body ${
          isOverlay
            ? "text-white hover:brightness-110"
            : "px-2.5 py-1 rounded-full border hover:brightness-95"
        }`}
        style={isOverlay
          ? { background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, padding: 0, minHeight: 44, backdropFilter: "none" }
          : { backgroundColor: hexToRgba(parkColor, 0.15), borderColor: parkColor, color: parkColor, minHeight: 44 }}
      >
        <Mountain size={14} style={{ opacity: 0.7 }} />
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, color: '#F0EDEA', letterSpacing: 'normal' }}>{active?.shortName ?? "Park"}</span>
        <ChevronDown size={8} style={{ opacity: 0.6 }} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`${dropdownRelative ? 'mt-1.5' : 'absolute top-full left-0 mt-1.5'} bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[210px]`}
            style={dropdownRelative ? { maxHeight: 240, overflowY: 'auto', width: '100%' } : undefined}
          >
            {parkList.map((park) => {
              const isWatched = watchedParkIds?.has(park.id) ?? false;
              const sublabel = PARK_SUBLABELS[park.id] ?? "";
              return (
                <button
                  key={park.id}
                  onClick={() => { onParkChange(park.id); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    park.id === activeParkId
                      ? "bg-secondary/10 text-secondary"
                      : "text-foreground hover:bg-muted"
                  }`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minHeight: 44 }}
                >
                  {isWatched && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#2F6F4E",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span className="font-body" style={{ fontSize: 14, fontWeight: 600 }}>
                      {toTitleCase(park.shortName)}
                    </span>
                    {sublabel && (
                      <span className="font-body" style={{ fontSize: 11, color: '#aaa', lineHeight: 1.2 }}>
                        {sublabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParkSelector;
