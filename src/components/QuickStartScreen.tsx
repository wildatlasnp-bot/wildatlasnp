import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import { PARKS, type ParkConfig } from "@/lib/parks";

const QUICK_PICKS = ["yosemite", "zion", "grand_canyon", "glacier", "arches"] as const;

interface Props {
  onStartTracking: (parkIds: string[]) => void;
}

const QuickStartScreen = ({ onStartTracking }: Props) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allParks = useMemo(() => Object.values(PARKS), []);

  const filteredParks = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allParks.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortName.toLowerCase().includes(q) ||
        p.region.toLowerCase().includes(q)
    );
  }, [search, allParks]);

  const togglePark = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    onStartTracking(Array.from(selected));
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        background:
          "linear-gradient(180deg, #1a2b1a 0%, #0f1a0f 55%, #0a120a 100%)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        paddingTop: 48,
        paddingBottom: 32,
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Mochi — functional helper role */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ marginBottom: 24 }}
        >
          <img
            src="/mochi-pointing.png"
            alt="Mochi"
            style={{
              width: 56,
              height: 56,
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              I'll monitor permits and notify you instantly.
            </p>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.2px",
            color: "#FFFFFF",
            marginBottom: 6,
          }}
        >
          Let's find your permits
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          style={{
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 28,
          }}
        >
          I'll start watching for openings right away.
        </motion.p>

        {/* Search field */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="relative"
          style={{ marginBottom: 16 }}
        >
          <Search
            size={16}
            className="absolute left-[14px] top-1/2 -translate-y-1/2"
            style={{ color: "rgba(255,255,255,0.3)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parks (Yosemite, Zion, Glacier…)"
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              paddingLeft: 40,
              paddingRight: 14,
              fontSize: 15,
              color: "rgba(255,255,255,0.85)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              outline: "none",
              transition: "border 150ms ease, box-shadow 150ms ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border =
                "1px solid rgba(120,180,140,0.6)";
              e.currentTarget.style.boxShadow =
                "0 0 0 2px rgba(120,180,140,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border =
                "1px solid rgba(255,255,255,0.10)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </motion.div>

        {/* Search results */}
        {filteredParks.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {filteredParks.map((park) => (
              <button
                key={park.id}
                onClick={() => {
                  togglePark(park.id);
                  setSearch("");
                }}
                className="w-full text-left flex items-center justify-between"
                style={{
                  padding: "12px 14px",
                  fontSize: 14,
                  color: selected.has(park.id)
                    ? "rgba(120,180,140,0.95)"
                    : "rgba(255,255,255,0.75)",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span>{park.shortName}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {park.region}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Quick picks */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          style={{ marginBottom: 28 }}
        >
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
              letterSpacing: "0.04em",
            }}
          >
            Popular parks
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PICKS.map((id) => {
              const park = PARKS[id];
              if (!park) return null;
              const isSelected = selected.has(id);
              return (
                <motion.button
                  key={id}
                  onClick={() => togglePark(id)}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: isSelected
                      ? "1px solid rgba(120,180,140,0.5)"
                      : "1px solid rgba(255,255,255,0.10)",
                    background: isSelected
                      ? "rgba(120,180,140,0.12)"
                      : "rgba(255,255,255,0.04)",
                    color: isSelected
                      ? "rgba(180,220,180,0.95)"
                      : "rgba(255,255,255,0.65)",
                    transition:
                      "background 150ms ease, border 150ms ease, color 150ms ease",
                  }}
                >
                  {park.shortName}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Selected indicator */}
        {selected.size > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 16,
            }}
          >
            {selected.size} park{selected.size > 1 ? "s" : ""} selected
          </motion.p>
        )}

        {/* CTA */}
        <motion.button
          onClick={handleSubmit}
          disabled={selected.size === 0}
          whileHover={selected.size > 0 ? { scale: 1.01 } : undefined}
          whileTap={selected.size > 0 ? { scale: 0.98 } : undefined}
          transition={{ duration: 0.15, ease: "easeOut" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex items-center justify-center gap-2"
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            color: "#FFFFFF",
            background:
              selected.size > 0 ? "#1e3a1e" : "rgba(255,255,255,0.04)",
            border:
              selected.size > 0
                ? "1px solid rgba(120,180,140,0.25)"
                : "1px solid rgba(255,255,255,0.06)",
            cursor: selected.size > 0 ? "pointer" : "default",
            opacity: selected.size > 0 ? 1 : 0.4,
            transition:
              "background 200ms ease, opacity 200ms ease, border 200ms ease",
          }}
        >
          Start tracking permits
          <ArrowRight size={16} style={{ opacity: 0.7 }} />
        </motion.button>
      </div>

      {/* Placeholder styles */}
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3) !important; }
      `}</style>
    </div>
  );
};

export default QuickStartScreen;
