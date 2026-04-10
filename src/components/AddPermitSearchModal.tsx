import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Mountain, Check, Loader2, ArrowRight, X, ChevronDown, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPermitIcon, getParkConfig, ALL_PARK_IDS } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";

const RECENTLY_VIEWED_KEY = "wildatlas_recently_viewed_permits";
const MAX_RECENT = 5;

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

interface PermitOption {
  name: string;
  description: string | null;
  park_id: string;
  total_finds: number;
}

interface AddPermitSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedPermits: { permit_name: string; park_id: string }[];
  onAddPermit: (permitName: string, parkId: string) => void;
}

function getRecentlyViewed(): { name: string; park_id: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
  } catch {
    return [];
  }
}

function addToRecentlyViewed(name: string, park_id: string) {
  const key = `${park_id}:${name}`;
  const existing = getRecentlyViewed().filter((r) => `${r.park_id}:${r.name}` !== key);
  const updated = [{ name, park_id }, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
}

const AddPermitSearchModal = ({
  open,
  onOpenChange,
  trackedPermits,
  onAddPermit,
}: AddPermitSearchModalProps) => {
  const [allPermits, setAllPermits] = useState<PermitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [showBrowse, setShowBrowse] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setAdding(null);
    setShowBrowse(false);
    setLoading(true);
    supabase
      .from("park_permits")
      .select("name, description, park_id, total_finds")
      .eq("is_active", true)
      .order("total_finds", { ascending: false })
      .then(({ data }) => {
        setAllPermits(data ?? []);
        setLoading(false);
      });
    setTimeout(() => searchRef.current?.focus(), 150);
  }, [open]);

  const trackedSet = useMemo(
    () => new Set(trackedPermits.map((t) => `${t.park_id}:${t.permit_name}`)),
    [trackedPermits]
  );

  const isTracked = useCallback(
    (parkId: string, name: string) => trackedSet.has(`${parkId}:${name}`),
    [trackedSet]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allPermits;
    const q = query.toLowerCase();
    return allPermits.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        getParkConfig(p.park_id).name.toLowerCase().includes(q) ||
        getParkConfig(p.park_id).shortName.toLowerCase().includes(q)
    );
  }, [allPermits, query]);

  const available = useMemo(
    () => allPermits.filter((p) => !isTracked(p.park_id, p.name)),
    [allPermits, isTracked]
  );

  const grouped = useMemo(() => {
    const source = query.trim() ? filtered : allPermits;
    const map = new Map<string, PermitOption[]>();
    for (const p of source) {
      const list = map.get(p.park_id) ?? [];
      list.push(p);
      map.set(p.park_id, list);
    }
    return ALL_PARK_IDS
      .filter((id) => map.has(id))
      .map((id) => ({ parkId: id, parkName: getParkConfig(id).shortName, permits: map.get(id)! }));
  }, [filtered, allPermits, query]);

  const handleAdd = useCallback(
    async (permit: PermitOption) => {
      if (isTracked(permit.park_id, permit.name)) return;
      if (!navigator.onLine) {
        const { toast } = await import("@/hooks/use-toast").then(m => ({ toast: m.toast }));
        toast({ title: "You're offline", description: "Connect to the internet to add a permit.", variant: "destructive" });
        return;
      }
      addToRecentlyViewed(permit.name, permit.park_id);
      setAdding(`${permit.park_id}:${permit.name}`);
      await onAddPermit(permit.name, permit.park_id);
      setAdding(null);
    },
    [onAddPermit, isTracked]
  );

  const recentlyViewed = useMemo(() => {
    const recent = getRecentlyViewed();
    return recent
      .map((r) => allPermits.find((p) => p.name === r.name && p.park_id === r.park_id))
      .filter(Boolean) as PermitOption[];
  }, [allPermits]);

  const recentKeys = useMemo(
    () => new Set(recentlyViewed.map((r) => `${r.park_id}:${r.name}`)),
    [recentlyViewed]
  );

  const popular = useMemo(
    () => available.filter((p) => !recentKeys.has(`${p.park_id}:${p.name}`)).slice(0, 3),
    [available, recentKeys]
  );

  const popularKeys = useMemo(
    () => new Set([...recentKeys, ...popular.map((p) => `${p.park_id}:${p.name}`)]),
    [recentKeys, popular]
  );

  const isSearching = query.trim().length > 0;
  const showRecent = !isSearching && recentlyViewed.length > 0;
  const showPopular = !isSearching && popular.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm p-0 gap-0 overflow-hidden border-0 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col !bg-[#F0EDEA]"
        style={{ background: "#F0EDEA" }}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <h2 style={{ fontFamily: CORMORANT, fontSize: 24, fontWeight: 400, color: "#1A1A1A", marginBottom: 4 }}>
            Add a permit
          </h2>
          <p style={{ fontFamily: DM_SANS, fontSize: 14, fontWeight: 400, color: "#999999", marginBottom: 16 }}>
            Search by permit or park name
          </p>

          {/* Search input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(28,24,18,0.3)" }} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Half Dome, Yosemite, Narrows…"
              className="w-full text-foreground placeholder:[color:rgba(26,47,30,0.30)] focus:outline-none transition-all"
              style={{
                background: "#EBE9E4",
                border: "none",
                borderRadius: 10,
                fontSize: 16,
                padding: "14px 16px 14px 42px",
                fontFamily: DM_SANS,
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(47,111,78,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : allPermits.length === 0 ? (
            <div className="text-center py-10">
              <p style={{ fontFamily: DM_SANS, fontSize: 13, color: "#999999" }}>No permits available.</p>
            </div>
          ) : isSearching ? (
            /* Search results — flat list */
            filtered.length === 0 ? (
              <div className="text-center py-10">
                <p style={{ fontFamily: DM_SANS, fontSize: 13, color: "#999999" }}>No permits match "{query}"</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p style={{ fontFamily: DM_SANS, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#6B7280", marginBottom: 8 }}>
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </p>
                {filtered.map((p) => (
                  <PermitRow
                    key={`${p.park_id}:${p.name}`}
                    permit={p}
                    tracked={isTracked(p.park_id, p.name)}
                    adding={adding === `${p.park_id}:${p.name}`}
                    onAdd={() => handleAdd(p)}
                  />
                ))}
              </div>
            )
          ) : (
            /* Default view: Recently Viewed → Popular → Browse All */
            <>
              {/* Recently Viewed */}
              {showRecent && (
                <div className="mb-5">
                  <p className="flex items-center gap-1.5" style={{ fontFamily: DM_SANS, fontSize: 12, fontWeight: 400, letterSpacing: "0.12em", color: "rgba(26,47,30,0.50)", marginBottom: 8 }}>
                    <Clock size={9} />
                    Recently viewed
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {recentlyViewed.map((p) => (
                      <PermitRow
                        key={`recent-${p.park_id}:${p.name}`}
                        permit={p}
                        tracked={isTracked(p.park_id, p.name)}
                        adding={adding === `${p.park_id}:${p.name}`}
                        onAdd={() => handleAdd(p)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Permits */}
              {showPopular && (
                <div className="mb-5">
                  {/* Hairline rule above section label */}
                  <div style={{ height: 1, background: "rgba(26,47,30,0.08)", marginBottom: 12 }} />
                  <p style={{ fontFamily: DM_SANS, fontSize: 12, fontWeight: 400, letterSpacing: "0.12em", color: "rgba(26,47,30,0.50)", marginBottom: 8 }}>
                    Popular permits
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {popular.map((p) => (
                      <PermitRow
                        key={`pop-${p.park_id}:${p.name}`}
                        permit={p}
                        tracked={isTracked(p.park_id, p.name)}
                        adding={adding === `${p.park_id}:${p.name}`}
                        onAdd={() => handleAdd(p)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Browse All Parks — collapsed by default */}
              <div>
                <button
                  onClick={() => setShowBrowse((v) => !v)}
                  className="flex items-center gap-1.5 font-bold transition-colors w-full py-2"
                  style={{ fontFamily: DM_SANS, fontSize: 11, color: "#2F6F4E" }}
                >
                  <Mountain size={11} />
                  Browse all parks
                  <ChevronDown size={12} className={`ml-auto transition-transform duration-200 ${showBrowse ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {showBrowse && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 pt-2">
                        {grouped.map((group) => (
                          <div key={group.parkId}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Mountain size={10} style={{ color: "#2F6F4E" }} />
                              <span style={{ fontFamily: DM_SANS, fontSize: 11, fontWeight: 700, color: "#2F6F4E" }}>{group.parkName}</span>
                              <div className="flex-1 h-px" style={{ background: "#D4CFC9" }} />
                            </div>
                            <div className="space-y-1.5">
                              {group.permits.map((p) => (
                                <PermitRow
                                  key={`browse-${p.park_id}:${p.name}`}
                                  permit={p}
                                  tracked={isTracked(p.park_id, p.name)}
                                  adding={adding === `${p.park_id}:${p.name}`}
                                  onAdd={() => handleAdd(p)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PARK_ICON_BG: Record<string, string> = {
  yosemite: "rgba(47,111,78,0.08)",
  "grand-canyon": "rgba(47,111,78,0.08)",
  zion: "rgba(47,111,78,0.08)",
  glacier: "rgba(47,111,78,0.08)",
  "grand-teton": "rgba(47,111,78,0.08)",
  "rocky-mountain": "rgba(47,111,78,0.08)",
  rainier: "rgba(47,111,78,0.08)",
  arches: "rgba(47,111,78,0.08)",
};

/** Single permit row — shows tracking state or add action */
const PermitRow = ({
  permit,
  tracked,
  adding,
  onAdd,
}: {
  permit: PermitOption;
  tracked: boolean;
  adding: boolean;
  onAdd: () => void;
}) => {
  const Icon = getPermitIcon(permit.name);
  const parkName = getParkConfig(permit.park_id).shortName;
  const iconBg = "rgba(47,111,78,0.08)";

  return (
    <button
      onClick={tracked ? undefined : onAdd}
      disabled={adding || tracked}
      className={`w-full flex items-center gap-3 p-3 border transition-all text-left group ${
        tracked
          ? "cursor-default"
          : "border-border/50 hover:border-primary/30 hover:bg-primary/3 disabled:opacity-60"
      }`}
      style={tracked ? {
        background: "transparent",
        border: "1px solid rgba(26,47,30,0.08)",
        borderRadius: 8,
        opacity: 1,
      } : { borderRadius: 8 }}
    >
      {/* Icon circle: park-tinted bg */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: iconBg, border: "none" }}
      >
        <Icon size={14} strokeWidth={1} style={{ color: "#2F6F4E" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: DM_SANS, fontSize: 13, fontWeight: 600, color: "#1A1A1A" }} className="truncate">{permit.name}</p>
        <p className="truncate" style={{ fontFamily: DM_SANS, fontSize: 12 }}>
          {tracked ? (
            <span style={{ color: "#2F6F4E", fontWeight: 500 }}>Tracking enabled</span>
          ) : (
            <span style={{ color: "rgba(26,47,30,0.40)" }}>
              {parkName}
              {permit.total_finds > 0 && ` · ${permit.total_finds} recent finds`}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0">
        {tracked ? (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2F6F4E", display: "inline-block" }} />
        ) : adding ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "#2F6F4E" }} />
        ) : (
          <ArrowRight size={14} className="group-hover:text-primary transition-colors" style={{ color: "rgba(28,24,18,0.2)" }} />
        )}
      </div>
    </button>
  );
};

export default AddPermitSearchModal;
