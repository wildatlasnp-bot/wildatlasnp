import { ChevronDown, Mountain } from "lucide-react";
import { PARKS, type ParkConfig } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  activeParkId: string;
  onParkChange: (parkId: string) => void;
  variant?: "default" | "overlay";
  dropdownRelative?: boolean;
  watchedParkIds?: Set<string>;
}

const parkList = Object.values(PARKS);

const PARK_COORDS: Record<string, string> = {
  yosemite: "37.8651° N",
  zion: "37.2982° N",
  glacier: "48.7596° N",
  rocky_mountain: "40.3428° N",
  rainier: "46.8523° N",
  arches: "38.7331° N",
  grand_canyon: "36.0544° N",
  grand_teton: "43.7904° N",
};

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const active = PARKS[activeParkId];
  const parkColor = active?.primaryColor ?? "var(--ranger-forest)";

  const isOverlay = variant === "overlay";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // Allow clicks inside the portaled menu (data-park-menu attribute)
      const menuEl = (target as HTMLElement)?.closest?.('[data-park-menu="true"]');
      if (menuEl) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useLayoutEffect(() => {
    if (!open || dropdownRelative) return;
    const updateRect = () => {
      if (!buttonRef.current) return;
      const r = buttonRef.current.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) });
    };
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, dropdownRelative]);

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
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 text-[12px] font-semibold tracking-wider transition-colors font-body ${
          isOverlay
            ? "w-full justify-between text-white hover:brightness-110"
            : "px-3.5 py-1 rounded-full border hover:brightness-95"
        }`}
        style={isOverlay
          ? { background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, padding: 0, minHeight: 44, backdropFilter: "none", width: "100%" }
          : { backgroundColor: hexToRgba(parkColor, 0.15), border: "1px solid var(--ranger-forest-tint-40)", color: parkColor, minHeight: 44 }}
      >
        {isOverlay ? (
          <>
            <span className="font-display-italic" style={{
              fontSize: 12,
              letterSpacing: '0.12em',
              color: 'rgba(245, 235, 211, 0.95)',
              lineHeight: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.45)',
            }}>
              {(active?.shortName ?? "PARK").toUpperCase()} — {PARK_COORDS[activeParkId] ?? ""}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600,
              letterSpacing: "0.22em", color: "rgba(245, 235, 211, 0.78)",
              textTransform: "uppercase",
              textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Change park <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </>
        ) : (
          <>
            <Mountain size={12} strokeWidth={1.5} />
            {active?.shortName ?? "Park"}
            <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>
      {(() => {
        const menu = (
          <AnimatePresence>
            {open && (
              <motion.div
                data-park-menu="true"
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className={`${dropdownRelative ? 'mt-1.5' : ''} border border-border rounded-xl overflow-hidden min-w-[210px]`}
                style={{
                  ...(dropdownRelative
                    ? { maxHeight: 240, overflowY: 'auto', width: '100%', position: 'relative' }
                    : {
                        position: 'fixed',
                        top: menuRect?.top ?? -9999,
                        left: menuRect?.left ?? -9999,
                        width: menuRect?.width,
                        maxHeight: 'calc(100vh - 120px)',
                        overflowY: 'auto',
                      }),
                  zIndex: 9999,
                  backgroundColor: 'var(--ranger-paper, #faf7f0)',
                  boxShadow:
                    '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 48px -16px rgba(20, 30, 24, 0.35), 0 6px 16px -6px rgba(20, 30, 24, 0.22)',
                  isolation: 'isolate',
                }}
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
                        background: "var(--ranger-forest)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span className="font-body" style={{ fontSize: 14, fontWeight: 600 }}>
                      {toTitleCase(park.shortName)}
                    </span>
                    {sublabel && (
                      <span className="font-body" style={{ fontSize: 12, color: 'var(--ranger-ink-faint)', lineHeight: 1.2 }}>
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
        );
        return dropdownRelative
          ? menu
          : (typeof document !== 'undefined' ? createPortal(menu, document.body) : null);
      })()}
    </div>
  );
};

export default ParkSelector;
