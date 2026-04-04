import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PARKS } from "@/lib/parks";

const parkList = Object.values(PARKS);

interface TripDateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (parkId: string, date: Date) => void;
  onRemove?: () => void;
  initialParkId: string;
  initialDate?: Date;
  isEditMode: boolean;
}

export default function TripDateModal({ open, onClose, onSave, onRemove, initialParkId, initialDate, isEditMode }: TripDateModalProps) {
  const [selectedParkId, setSelectedParkId] = useState(initialParkId);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) {
      const y = initialDate.getFullYear();
      const m = String(initialDate.getMonth() + 1).padStart(2, "0");
      const d = String(initialDate.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return "";
  });

  useEffect(() => {
    if (open) {
      setSelectedParkId(initialParkId);
      if (initialDate) {
        const y = initialDate.getFullYear();
        const m = String(initialDate.getMonth() + 1).padStart(2, "0");
        const d = String(initialDate.getDate()).padStart(2, "0");
        setSelectedDate(`${y}-${m}-${d}`);
      } else {
        setSelectedDate("");
      }
    }
  }, [open, initialParkId, initialDate]);

  const todayStr = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const handleSave = useCallback(() => {
    if (!selectedDate) return;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    onSave(selectedParkId, date);
    onClose();
  }, [selectedDate, selectedParkId, onSave, onClose]);

  const handleRemove = useCallback(() => {
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998 }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxWidth: 480,
              margin: "0 auto",
              background: "var(--color-background-primary, #fff)",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              zIndex: 9999,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Handle bar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
            </div>

            {/* Header */}
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: "var(--color-text-primary, #1C1C1A)", margin: 0 }}>
              Plan your trip
            </h2>
            <p style={{ fontSize: 13, color: "#6B6860", marginTop: 4, marginBottom: 24 }}>
              We'll brief you on permits, crowds, and conditions.
            </p>

            {/* Park selector */}
            <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "#6B6860", marginBottom: 8 }}>
              Park
            </label>
            <select
              value={selectedParkId}
              onChange={(e) => setSelectedParkId(e.target.value)}
              style={{
                width: "100%",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                color: "var(--color-text-primary, #1C1C1A)",
                background: "var(--color-background-primary, #fff)",
                appearance: "none",
                WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6860' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
                cursor: "pointer",
              }}
            >
              {parkList.map((p) => (
                <option key={p.id} value={p.id}>{p.shortName}</option>
              ))}
            </select>

            {/* Date input */}
            <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "#6B6860", marginTop: 20, marginBottom: 8 }}>
              Target Date
            </label>
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: "100%",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                color: selectedDate ? "var(--color-text-primary, #1C1C1A)" : "#6B6860",
                background: "var(--color-background-primary, #fff)",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            />

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!selectedDate}
              style={{
                width: "100%",
                background: selectedDate ? "#2F6F4E" : "rgba(47,111,78,0.4)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                padding: 14,
                borderRadius: 12,
                border: "none",
                cursor: selectedDate ? "pointer" : "not-allowed",
                marginTop: 24,
                transition: "background 0.15s",
              }}
            >
              Save trip date
            </button>

            {/* Remove option — edit mode only */}
            {isEditMode && (
              <button
                onClick={handleRemove}
                style={{
                  display: "block",
                  width: "100%",
                  background: "none",
                  border: "none",
                  fontSize: 13,
                  color: "#E24B4A",
                  textAlign: "center",
                  marginTop: 16,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                Remove trip date
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
