import { useState, useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { format, parseISO, formatDistanceToNow, differenceInHours } from "date-fns";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { getParkConfig } from "@/lib/parks";
import type { RecentFindsData, RecentFind } from "@/hooks/useRecentFinds";

interface PermitFeedProps {
  recentFinds: RecentFindsData;
  trackedParkIds?: Set<string>;
  hasTrackedPermits?: boolean;
}

const VISIBLE_COUNT = 7;

function detectedAgo(foundAt: string): string {
  const dist = formatDistanceToNow(parseISO(foundAt), { addSuffix: false });
  if (dist.includes("less than")) return "Detected just now";
  return `Detected ${dist} ago`;
}

function agingOpacity(foundAt: string): string {
  const hours = differenceInHours(new Date(), parseISO(foundAt));
  if (hours < 24) return "opacity-100";
  if (hours < 72) return "opacity-80";
  return "opacity-60";
}

const FeedItem = ({
  find,
  isNew,
  staggerIndex,
  onClick,
}: {
  find: RecentFind;
  isNew: boolean;
  staggerIndex: number;
  onClick: () => void;
}) => {
  const [phase, setPhase] = useState<"entrance" | "glow" | "done">(isNew ? "entrance" : "done");
  const itemRef = useRef<HTMLDivElement>(null);
  const parkConfig = getParkConfig(find.park_id);

  useEffect(() => {
    if (!isNew) return;
    const el = itemRef.current;
    if (!el) return;
    const handleEnd = () => {
      if (phase === "entrance") setPhase("glow");
      else if (phase === "glow") setPhase("done");
    };
    el.addEventListener("animationend", handleEnd, { once: true });
    return () => el.removeEventListener("animationend", handleEnd);
  }, [phase, isNew]);

  const dates = find.available_dates ?? [];
  const earliestDate = dates.length > 0 ? dates.sort()[0] : null;

  const animClass =
    phase === "entrance"
      ? "permit-discover-entrance"
      : phase === "glow"
        ? "permit-discover-glow"
        : "";
  const animDelay = phase === "entrance" ? `${staggerIndex * 100}ms` : undefined;

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerIndex * 0.04, duration: 0.2 }}
      onClick={onClick}
      className={`py-3 border-b border-border/30 last:border-b-0 cursor-pointer active:bg-muted/30 transition-colors rounded-lg ${agingOpacity(find.found_at)} ${animClass}`}
      style={{ animationDelay: animDelay }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`View details for ${find.permit_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold text-foreground truncate leading-snug font-body">
            {find.permit_name}
          </h4>
          <p className="text-[13px] font-normal text-muted-foreground/60 leading-snug mt-0.5">
            {parkConfig.shortName}
          </p>
          <p className="text-[13px] font-normal text-muted-foreground/60 leading-snug mt-0.5">
            {detectedAgo(find.found_at)}
          </p>
        </div>
        {earliestDate && (
          <span className="text-[12px] font-medium text-status-found bg-status-found/10 rounded-full px-2.5 py-0.5 shrink-0">
            {format(parseISO(earliestDate), "MMM d")}
          </span>
        )}
      </div>
    </motion.div>
  );
};

const FindDetailSheet = ({
  find,
  open,
  onOpenChange,
}: {
  find: RecentFind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  if (!find) return null;

  const parkConfig = getParkConfig(find.park_id);
  const dates = find.available_dates ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "rounded-t-2xl max-h-[85vh] overflow-y-auto" : "w-[400px]"}
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-[18px] font-bold text-foreground">{find.permit_name}</SheetTitle>
          <SheetDescription className="text-[14px] text-muted-foreground">
            {parkConfig.name}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {find.location_name && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Location</p>
              <p className="text-[14px] text-foreground">{find.location_name}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Detected</p>
            <p className="text-[14px] text-foreground">{detectedAgo(find.found_at)}</p>
          </div>

          {dates.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">Available Dates</p>
              <div className="flex flex-wrap gap-2">
                {dates.sort().map((d) => (
                  <span
                    key={d}
                    className="text-[12px] font-semibold bg-status-found/10 text-status-found px-2 py-1 rounded-md"
                  >
                    {format(parseISO(d), "MMM d, yyyy")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              This opening was detected by the scanner. Availability may have already been claimed — check Recreation.gov to confirm.
            </p>
          </div>

          <a
            href="https://www.recreation.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] hover:bg-primary/90 transition-colors"
          >
            <ExternalLink size={16} />
            Check on Recreation.gov
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const PermitFeed = ({ recentFinds, trackedParkIds, hasTrackedPermits }: PermitFeedProps) => {
  const { finds: allFinds, newIds, loading } = recentFinds;

  const finds = trackedParkIds && trackedParkIds.size > 0
    ? allFinds.filter((f) => trackedParkIds.has(f.park_id))
    : allFinds;
  const [expanded, setExpanded] = useState(false);
  const [selectedFind, setSelectedFind] = useState<RecentFind | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const staggerMap = useRef(new Map<string, number>());
  const staggerCounter = useRef(0);

  for (const id of newIds) {
    if (!staggerMap.current.has(id)) {
      staggerMap.current.set(id, staggerCounter.current++);
    }
  }

  const visible = expanded ? finds : finds.slice(0, VISIBLE_COUNT);
  const hasMore = finds.length > VISIBLE_COUNT;

  const handleItemClick = (find: RecentFind) => {
    setSelectedFind(find);
    setDetailOpen(true);
  };

  return (
    <div className="px-5 mb-5">
      <div className="mb-1">
        <span className="text-[15px] font-semibold text-foreground font-body">Recent Permit Openings</span>
      </div>
      <p className="text-[13px] font-normal text-muted-foreground/60 mb-3 font-body">
        Recent activity across monitored parks
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
          <span className="text-[12px] text-muted-foreground">Loading…</span>
        </div>
      ) : finds.length === 0 ? (
        <div className="py-4 px-3 bg-muted/20 rounded-xl">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {(!trackedParkIds || trackedParkIds.size === 0)
              ? "Start tracking a permit to see recent openings here."
              : "No openings detected yet. The scanner will notify you when availability appears."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {visible.map((f, idx) => (
              <FeedItem
                key={f.id}
                find={f}
                isNew={newIds.has(f.id)}
                staggerIndex={staggerMap.current.get(f.id) ?? idx}
                onClick={() => handleItemClick(f)}
              />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[13px] font-normal text-secondary hover:underline mt-3"
            >
              {expanded ? "Show less" : "View all activity"}
            </button>
          )}
        </>
      )}

      <FindDetailSheet
        find={selectedFind}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

export default PermitFeed;
