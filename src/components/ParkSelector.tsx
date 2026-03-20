import { ChevronDown, Mountain } from "lucide-react";
import { PARKS, type ParkConfig } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface Props {
  activeParkId: string;
  onParkChange: (parkId: string) => void;
  variant?: "default" | "overlay";
}

const parkList = Object.values(PARKS);

const ParkSelector = ({ activeParkId, onParkChange, variant = "default" }: Props) => {
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
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
          isOverlay
            ? "text-white hover:brightness-110"
            : "px-2.5 py-1 rounded-full border"
        }`}
        style={isOverlay
          ? { background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", borderRadius: "20px", padding: "6px 12px" }
          : { background: "#EAF3DE", color: "#2F6F4E", borderColor: "#C0DD97" }}
        }`}
        style={isOverlay ? { background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", borderRadius: "20px", padding: "6px 12px" } : undefined}
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
            className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px]"
          >
            {parkList.map((park) => (
              <button
                key={park.id}
                onClick={() => { onParkChange(park.id); setOpen(false); }}
                className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors ${
                  park.id === activeParkId
                    ? "bg-secondary/10 text-secondary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="font-semibold">{park.shortName}</span>
                <span className="text-[11px] text-muted-foreground ml-1.5">{park.region}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParkSelector;
