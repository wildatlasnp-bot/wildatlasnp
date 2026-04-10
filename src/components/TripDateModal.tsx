import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PARKS } from "@/lib/parks";
import { format } from "date-fns";

const parkList = Object.values(PARKS);
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface TripDateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (parkId: string, date: Date) => void;
  onRemove?: () => void;
  initialParkId: string;
  initialDate?: Date;
  isEditMode: boolean;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarPicker({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const [viewMonth, setViewMonth] = useState(() => selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  return (
    <div style={{ userSelect: "none" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" onClick={prevMonth} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", lineHeight: 0 }}>
          <ChevronLeft size={18} color="#2F6F4E" />
        </button>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400, color: "var(--color-text-primary, #1C1C1A)" }}>
          {monthLabel}
        </span>
        <button type="button" onClick={nextMonth} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", lineHeight: 0 }}>
          <ChevronRight size={18} color="#2F6F4E" />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <span key={w} style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", padding: "4px 0" }}>{w}</span>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const date = new Date(year, month, day);
          const isPast = date < today;
          const isToday = isSameDay(date, today);
          const isSelected = selected && isSameDay(date, selected);

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(date)}
              style={{
                width: 36,
                height: 36,
                margin: "2px auto",
                borderRadius: "50%",
                border: isToday && !isSelected ? "1.5px solid #2F6F4E" : "none",
                background: isSelected ? "#2F6F4E" : "transparent",
                color: isSelected ? "#fff" : isPast ? "rgba(28,28,26,0.35)" : "var(--color-text-primary, #1C1C1A)",
                fontSize: 14,
                fontWeight: isSelected ? 600 : 400,
                cursor: isPast ? "default" : "pointer",
                opacity: 1,
                outline: "none",
                WebkitTapHighlightColor: "transparent",
                padding: 0,
                lineHeight: "36px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TripDateModal({ open, onClose, onSave, onRemove, initialParkId, initialDate, isEditMode }: TripDateModalProps) {
  const [selectedParkId, setSelectedParkId] = useState(initialParkId);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate ?? null);

  useEffect(() => {
    if (open) {
      setSelectedParkId(initialParkId);
      setSelectedDate(initialDate ?? null);
    }
  }, [open, initialParkId, initialDate]);

  const handleSave = useCallback(() => {
    if (!selectedDate) return;
    onSave(selectedParkId, selectedDate);
    onClose();
  }, [selectedDate, selectedParkId, onSave, onClose]);

  const handleRemove = useCallback(() => {
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const ctaLabel = selectedDate
    ? `Get Poko's briefing for ${format(selectedDate, "MMMM d")}`
    : "Select a date";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998 }}
          />
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
              zIndex: 9999,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Scrollable content area */}
            <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "24px 20px 0", minHeight: 0 }}>
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

              {/* Calendar */}
              <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "#6B6860", marginTop: 20, marginBottom: 12 }}>
                Target Date
              </label>
              <CalendarPicker selected={selectedDate} onSelect={setSelectedDate} />

              {/* Spacer so content doesn't hide behind fixed footer */}
              <div style={{ height: 24 }} />
            </div>

            {/* Fixed bottom CTA */}
            <div style={{
              flex: "0 0 auto",
              padding: "12px 20px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              borderTop: "0.5px solid rgba(0,0,0,0.08)",
              background: "var(--color-background-primary, #fff)",
            }}>
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
                  transition: "background 0.15s",
                }}
              >
                {ctaLabel}
              </button>

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
                    marginTop: 12,
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  Remove trip date
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
