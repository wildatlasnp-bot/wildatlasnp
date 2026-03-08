import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Mountain, Check, Loader2, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPermitIcon, getParkConfig, ALL_PARK_IDS } from "@/lib/parks";
import { motion, AnimatePresence } from "framer-motion";

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

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setAdding(null);
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
  }, [open]);

  const trackedSet = useMemo(
    () => new Set(trackedPermits.map((t) => `${t.park_id}:${t.permit_name}`)),
    [trackedPermits]
  );

  const available = useMemo(
    () => allPermits.filter((p) => !trackedSet.has(`${p.park_id}:${p.name}`)),
    [allPermits, trackedSet]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return available;
    const q = query.toLowerCase();
    return available.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        getParkConfig(p.park_id).name.toLowerCase().includes(q) ||
        getParkConfig(p.park_id).shortName.toLowerCase().includes(q)
    );
  }, [available, query]);

  // Group by park for browse view
  const grouped = useMemo(() => {
    const map = new Map<string, PermitOption[]>();
    for (const p of filtered) {
      const list = map.get(p.park_id) ?? [];
      list.push(p);
      map.set(p.park_id, list);
    }
    return ALL_PARK_IDS
      .filter((id) => map.has(id))
      .map((id) => ({ parkId: id, parkName: getParkConfig(id).shortName, permits: map.get(id)! }));
  }, [filtered]);

  const handleAdd = useCallback(
    async (permit: PermitOption) => {
      setAdding(`${permit.park_id}:${permit.name}`);
      await onAddPermit(permit.name, permit.park_id);
      setAdding(null);
    },
    [onAddPermit]
  );

  // Popular permits (highest total_finds, untracked)
  const popular = useMemo(
    () => available.slice(0, 3),
    [available]
  );

  const showPopular = !query.trim() && popular.length > 0;

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
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Half Dome, Yosemite, Narrows…"
              autoFocus
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border/70 bg-muted/30 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
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
          ) : available.length === 0 ? (
            <div className="text-center py-10">
              <Check size={20} className="mx-auto text-status-quiet mb-2" />
              <p className="text-[13px] font-bold text-foreground/70">You're tracking everything!</p>
              <p className="text-[11px] text-muted-foreground mt-1">All available permits are being monitored.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-muted-foreground">No permits match "{query}"</p>
            </div>
          ) : (
            <>
              {/* Popular suggestions (only when no search) */}
              {showPopular && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Popular permits
                  </p>
                  <div className="space-y-1.5">
                    {popular.map((p) => (
                      <PermitRow
                        key={`${p.park_id}:${p.name}`}
                        permit={p}
                        adding={adding === `${p.park_id}:${p.name}`}
                        onAdd={() => handleAdd(p)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped results */}
              <div className="space-y-4">
                {!showPopular && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {query ? "Results" : "All permits"}
                  </p>
                )}
                {showPopular && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Browse by park
                  </p>
                )}
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
                          key={`${p.park_id}:${p.name}`}
                          permit={p}
                          adding={adding === `${p.park_id}:${p.name}`}
                          onAdd={() => handleAdd(p)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Single permit row with inline Add button */
const PermitRow = ({
  permit,
  adding,
  onAdd,
}: {
  permit: PermitOption;
  adding: boolean;
  onAdd: () => void;
}) => {
  const Icon = getPermitIcon(permit.name);
  const parkName = getParkConfig(permit.park_id).shortName;

  return (
    <button
      onClick={onAdd}
      disabled={adding}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/3 transition-all text-left group disabled:opacity-60"
    >
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{permit.name}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">
          {parkName}
          {permit.total_finds > 0 && ` · ${permit.total_finds} recent finds`}
        </p>
      </div>
      <div className="shrink-0">
        {adding ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : (
          <ArrowRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
        )}
      </div>
    </button>
  );
};

export default AddPermitSearchModal;
