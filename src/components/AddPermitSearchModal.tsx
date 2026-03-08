import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Mountain, Check, Loader2, ArrowRight, X, ChevronDown, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPermitIcon, getParkConfig, ALL_PARK_IDS } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";

const RECENTLY_VIEWED_KEY = "wildatlas_recently_viewed_permits";
const MAX_RECENT = 5;

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
    // Auto-focus search after a brief delay for dialog animation
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

  // All permits (tracked ones stay in list but shown differently)
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

  // Available (untracked) for popular section
  const available = useMemo(
    () => allPermits.filter((p) => !isTracked(p.park_id, p.name)),
    [allPermits, isTracked]
  );

  // Group by park for browse view
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
      addToRecentlyViewed(permit.name, permit.park_id);
      setAdding(`${permit.park_id}:${permit.name}`);
      await onAddPermit(permit.name, permit.park_id);
      setAdding(null);
    },
    [onAddPermit, isTracked]
  );

  // Popular permits (highest total_finds, untracked, deduplicated from recently viewed)
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
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3">
          <h2 className="text-[17px] font-heading font-bold text-foreground mb-1">
            Add a permit
          </h2>
          <p className="text-[11px] text-muted-foreground mb-4">
            Search by permit or park name
          </p>

          {/* Search input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Half Dome, Yosemite, Narrows…"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border/70 bg-muted/30 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
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
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : allPermits.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-muted-foreground">No permits available.</p>
            </div>
          ) : isSearching ? (
            /* Search results — flat list */
            filtered.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[13px] text-muted-foreground">No permits match "{query}"</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
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
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Clock size={9} />
                    Recently viewed
                  </p>
                  <div className="space-y-1.5">
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
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Popular permits
                  </p>
                  <div className="space-y-1.5">
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
                  className="flex items-center gap-1.5 text-[11px] font-bold text-secondary hover:text-secondary/80 transition-colors w-full py-2"
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
                              <Mountain size={10} className="text-secondary" />
                              <span className="text-[11px] font-bold text-secondary">{group.parkName}</span>
                              <div className="flex-1 h-px bg-border/40" />
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

  return (
    <button
      onClick={tracked ? undefined : onAdd}
      disabled={adding || tracked}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
        tracked
          ? "border-status-quiet/20 bg-status-quiet/5 cursor-default opacity-80"
          : "border-border/50 hover:border-primary/30 hover:bg-primary/3 disabled:opacity-60"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        tracked ? "bg-status-quiet/10" : "bg-muted"
      }`}>
        <Icon size={14} className={tracked ? "text-status-quiet" : "text-muted-foreground"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{permit.name}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">
          {tracked ? (
            <span className="text-status-quiet font-semibold">Tracking enabled</span>
          ) : (
            <>
              {parkName}
              {permit.total_finds > 0 && ` · ${permit.total_finds} recent finds`}
            </>
          )}
        </p>
      </div>
      <div className="shrink-0">
        {tracked ? (
          <Check size={14} className="text-status-quiet" />
        ) : adding ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : (
          <ArrowRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
        )}
      </div>
    </button>
  );
};

export default AddPermitSearchModal;
