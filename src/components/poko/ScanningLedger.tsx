/**
 * ScanningLedger — persistent horizontal pill row that surfaces the
 * constraints the user has told Poko to scan against (date range,
 * weekday filter, party size, custom). Each pill is a tactical,
 * monospaced badge. Tapping a pill opens a tiny popover with
 * [Edit] / [Remove] actions so users never have to retype what
 * they already said in chat.
 *
 * State is stored locally per park in localStorage so it persists
 * across reloads and tab switches without backend changes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, X, Calendar, Users, CalendarDays, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { haptics } from "@/lib/haptics";

export type ConstraintKind = "dates" | "weekdays" | "party" | "custom";

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  /** Display label, already formatted for the pill (uppercased, monospace). */
  label: string;
  /** Free-form payload (raw user text or structured value). */
  value?: string;
}

interface ScanningLedgerProps {
  parkId: string | null;
  /** Optional: notify host when constraints change (for analytics, etc). */
  onChange?: (constraints: Constraint[]) => void;
}

const STORAGE_PREFIX = "poko_constraints::";

/* ---------- persistence ---------- */
const readStore = (parkId: string | null): Constraint[] => {
  if (!parkId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + parkId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStore = (parkId: string | null, items: Constraint[]) => {
  if (!parkId || typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + parkId, JSON.stringify(items));
  } catch {
    /* quota exceeded — non-fatal */
  }
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const KIND_META: Record<
  ConstraintKind,
  { icon: typeof Calendar; placeholder: string; title: string }
> = {
  dates:    { icon: Calendar,     placeholder: "MAY 12-15",        title: "Date range" },
  weekdays: { icon: CalendarDays, placeholder: "TUE/WED ONLY",     title: "Weekdays" },
  party:    { icon: Users,        placeholder: "2 PEOPLE",         title: "Party size" },
  custom:   { icon: Tag,          placeholder: "PERMIT TYPE",      title: "Custom" },
};

const normalize = (s: string) => s.trim().toUpperCase().slice(0, 28);

/* ---------- component ---------- */
export default function ScanningLedger({ parkId, onChange }: ScanningLedgerProps) {
  const [items, setItems] = useState<Constraint[]>(() => readStore(parkId));
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [adderOpen, setAdderOpen] = useState(false);
  const [draftKind, setDraftKind] = useState<ConstraintKind>("dates");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Reload on park change
  useEffect(() => {
    setItems(readStore(parkId));
    setOpenId(null);
    setEditingId(null);
    setAdderOpen(false);
  }, [parkId]);

  const persist = useCallback(
    (next: Constraint[]) => {
      setItems(next);
      writeStore(parkId, next);
      onChange?.(next);
    },
    [parkId, onChange],
  );

  const addConstraint = useCallback(
    (kind: ConstraintKind, label: string) => {
      const clean = normalize(label);
      if (!clean) return;
      const next = [...items, { id: newId(), kind, label: clean }];
      persist(next);
      haptics.light();
      setAdderOpen(false);
      setDraftLabel("");
    },
    [items, persist],
  );

  const updateConstraint = useCallback(
    (id: string, label: string) => {
      const clean = normalize(label);
      if (!clean) return;
      persist(items.map((c) => (c.id === id ? { ...c, label: clean } : c)));
      haptics.light();
      setEditingId(null);
      setOpenId(null);
    },
    [items, persist],
  );

  const removeConstraint = useCallback(
    (id: string) => {
      persist(items.filter((c) => c.id !== id));
      haptics.medium();
      setOpenId(null);
      setEditingId(null);
    },
    [items, persist],
  );

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const monoFont =
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

  const pillBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: 6,
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: "0.06em",
    fontWeight: 500,
    whiteSpace: "nowrap",
    background: "rgba(240,237,234,0.06)",
    color: "rgba(240,237,234,0.92)",
    border: "1px solid rgba(240,237,234,0.18)",
    cursor: "pointer",
    transition: "background 180ms cubic-bezier(0.4,0,0.2,1), border-color 180ms cubic-bezier(0.4,0,0.2,1)",
  };

  const addPillStyle: React.CSSProperties = {
    ...pillBase,
    background: "transparent",
    color: "rgba(201,169,110,0.95)",
    border: "1px dashed rgba(201,169,110,0.55)",
  };

  const hasItems = items.length > 0;

  return (
    <div
      role="region"
      aria-label="Scanning ledger — active constraints"
      style={{
        position: "relative",
        flexShrink: 0,
        background:
          "linear-gradient(to bottom, rgba(11,43,27,0.55) 0%, rgba(11,43,27,0.25) 70%, transparent 100%)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          padding: "8px 16px 10px",
          scrollbarWidth: "none",
        }}
        // hide webkit scrollbar
        className="poko-ledger-scroll"
      >
        <style>{`
          .poko-ledger-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Eyebrow */}
        <span
          aria-hidden="true"
          style={{
            fontFamily: monoFont,
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(240,237,234,0.45)",
            textTransform: "uppercase",
            paddingRight: 4,
            flexShrink: 0,
          }}
        >
          {hasItems ? "SCAN ▸" : "LEDGER ▸"}
        </span>

        {items.map((c) => {
          const Icon = KIND_META[c.kind].icon;
          const isOpen = openId === c.id;
          const isEditing = editingId === c.id;
          return (
            <Popover
              key={c.id}
              open={isOpen}
              onOpenChange={(o) => {
                setOpenId(o ? c.id : null);
                if (!o) setEditingId(null);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${KIND_META[c.kind].title}: ${c.label}. Tap to edit or remove.`}
                  style={{
                    ...pillBase,
                    background: isOpen
                      ? "rgba(201,169,110,0.16)"
                      : pillBase.background,
                    borderColor: isOpen
                      ? "rgba(201,169,110,0.65)"
                      : pillBase.border as string,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={11} strokeWidth={2} aria-hidden="true" />
                  {c.label}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[240px] p-2 pointer-events-auto"
                style={{
                  background: "#0F2A1B",
                  border: "1px solid rgba(201,169,110,0.35)",
                  color: "rgba(240,237,234,0.95)",
                }}
              >
                {!isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div
                      style={{
                        fontFamily: monoFont,
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        color: "rgba(240,237,234,0.5)",
                        padding: "4px 8px 6px",
                        textTransform: "uppercase",
                      }}
                    >
                      {KIND_META[c.kind].title}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftLabel(c.label);
                        setEditingId(c.id);
                      }}
                      aria-label="Edit constraint"
                      style={menuItemStyle}
                    >
                      <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeConstraint(c.id)}
                      aria-label="Remove constraint"
                      style={{ ...menuItemStyle, color: "rgba(232,143,143,0.95)" }}
                    >
                      <X size={14} strokeWidth={1.8} aria-hidden="true" />
                      Remove constraint
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateConstraint(c.id, draftLabel);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}
                  >
                    <label
                      htmlFor={`edit-${c.id}`}
                      style={{
                        fontFamily: monoFont,
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        color: "rgba(240,237,234,0.5)",
                        textTransform: "uppercase",
                      }}
                    >
                      {KIND_META[c.kind].title}
                    </label>
                    <input
                      ref={editInputRef}
                      id={`edit-${c.id}`}
                      type="text"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      placeholder={KIND_META[c.kind].placeholder}
                      maxLength={28}
                      style={inputStyle(monoFont)}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="submit" style={primaryBtnStyle(monoFont)}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setOpenId(null);
                        }}
                        style={ghostBtnStyle(monoFont)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </PopoverContent>
            </Popover>
          );
        })}

        {/* Add pill */}
        <Popover
          open={adderOpen}
          onOpenChange={(o) => {
            setAdderOpen(o);
            if (!o) {
              setDraftLabel("");
              setDraftKind("dates");
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add scanning constraint"
              style={{ ...addPillStyle, flexShrink: 0 }}
            >
              <Plus size={12} strokeWidth={2.2} aria-hidden="true" />
              {hasItems ? "ADD" : "ADD CONSTRAINT"}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[260px] p-2 pointer-events-auto"
            style={{
              background: "#0F2A1B",
              border: "1px solid rgba(201,169,110,0.35)",
              color: "rgba(240,237,234,0.95)",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addConstraint(draftKind, draftLabel);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}
            >
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "rgba(240,237,234,0.5)",
                  textTransform: "uppercase",
                }}
              >
                New constraint
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(Object.keys(KIND_META) as ConstraintKind[]).map((k) => {
                  const isActive = draftKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDraftKind(k)}
                      style={{
                        fontFamily: monoFont,
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: `1px solid ${isActive ? "rgba(201,169,110,0.7)" : "rgba(240,237,234,0.18)"}`,
                        background: isActive ? "rgba(201,169,110,0.16)" : "transparent",
                        color: isActive ? "rgba(240,237,234,0.95)" : "rgba(240,237,234,0.65)",
                        cursor: "pointer",
                      }}
                    >
                      {KIND_META[k].title}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                autoFocus
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder={KIND_META[draftKind].placeholder}
                maxLength={28}
                style={inputStyle(monoFont)}
                aria-label="Constraint value"
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" style={primaryBtnStyle(monoFont)}>
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdderOpen(false);
                    setDraftLabel("");
                  }}
                  style={ghostBtnStyle(monoFont)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/* ---------- shared inline styles ---------- */
const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  background: "transparent",
  border: "none",
  fontSize: 13,
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  minHeight: 36,
};

const inputStyle = (mono: string): React.CSSProperties => ({
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 4,
  border: "1px solid rgba(240,237,234,0.22)",
  background: "rgba(240,237,234,0.04)",
  color: "rgba(240,237,234,0.98)",
  fontFamily: mono,
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  outline: "none",
});

const primaryBtnStyle = (mono: string): React.CSSProperties => ({
  flex: 1,
  height: 32,
  borderRadius: 4,
  border: "1px solid rgba(201,169,110,0.7)",
  background: "rgba(201,169,110,0.18)",
  color: "rgba(240,237,234,0.98)",
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
});

const ghostBtnStyle = (mono: string): React.CSSProperties => ({
  flex: 1,
  height: 32,
  borderRadius: 4,
  border: "1px solid rgba(240,237,234,0.2)",
  background: "transparent",
  color: "rgba(240,237,234,0.8)",
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
});
