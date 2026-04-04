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

  const isOverlay = variant === "overlay";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
          ? { background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", borderRadius: "20px", padding: "6px 12px", minHeight: 44 }
          : { backgroundColor: active?.pillBg, borderColor: "rgba(47,111,78,0.5)", color: "#2F6F4E", minHeight: 44 }}
      >
        <Mountain size={12} />
        {active?.shortName ?? "Park"}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
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
