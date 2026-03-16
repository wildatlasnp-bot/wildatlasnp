import { useState, useMemo } from "react";
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

interface GroupedFind {
  key: string;
  park_id: string;
  permit_name: string;
  count: number;
  mostRecent: RecentFind;
  allDates: string[];
}

function groupFinds(finds: RecentFind[]): GroupedFind[] {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  const map = new Map<string, { finds: RecentFind[]; dates: Set<string> }>();

  for (const f of finds) {
    const key = `${f.park_id}::${f.permit_name}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { finds: [], dates: new Set() };
      map.set(key, entry);
    }
    entry.finds.push(f);
    for (const d of f.available_dates ?? []) {
      entry.dates.add(d);
    }
  }

  const groups: GroupedFind[] = [];
  for (const [key, entry] of map) {
    const sorted = entry.finds.sort(
      (a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime()
    );
    const weekCount = sorted.filter(
      (f) => new Date(f.found_at).getTime() >= weekAgo
    ).length;

    groups.push({
      key,
      park_id: sorted[0].park_id,
      permit_name: sorted[0].permit_name,
      count: weekCount,
      mostRecent: sorted[0],
      allDates: [...entry.dates].sort(),
    });
  }

  // Sort by most recent detection
  groups.sort(
    (a, b) =>
      new Date(b.mostRecent.found_at).getTime() -
      new Date(a.mostRecent.found_at).getTime()
  );

  return groups;
}

function timeAgoShort(foundAt: string): string {
  const dist = formatDistanceToNow(parseISO(foundAt), { addSuffix: false });
  if (dist.includes("less than")) return "just now";
  return `${dist} ago`;
}

function agingOpacity(foundAt: string): string {
  const hours = differenceInHours(new Date(), parseISO(foundAt));
  if (hours < 24) return "opacity-100";
  if (hours < 72) return "opacity-80";
  return "opacity-60";
}

const GroupedFeedItem = ({
  group,
  staggerIndex,
  onClick,
}: {
  group: GroupedFind;
  staggerIndex: number;
  onClick: () => void;
}) => {
  const parkConfig = getParkConfig(group.park_id);
  const earliestDate = group.allDates.length > 0 ? group.allDates[0] : null;

  const activityLine =
    group.count > 1
      ? `${group.count} openings in the last 7 days · Last opening ${timeAgoShort(group.mostRecent.found_at)}`
      : `Last opening · ${timeAgoShort(group.mostRecent.found_at)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerIndex * 0.04, duration: 0.2 }}
      onClick={onClick}
      className={`bg-muted/40 rounded-xl px-4 py-3 cursor-pointer active:bg-muted/50 transition-colors ${agingOpacity(group.mostRecent.found_at)}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`View details for ${group.permit_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold text-foreground truncate leading-snug font-body">
            {group.permit_name}
          </h4>
          <p className="text-[12px] font-normal text-muted-foreground leading-snug mt-0.5">
            {parkConfig.shortName}
          </p>
          <p className="text-[12px] font-normal text-muted-foreground leading-snug mt-1">
            {activityLine}
          </p>
        </div>
        {earliestDate && (
          <span
            className="text-[12px] shrink-0"
            style={{
              background: "rgba(76,175,80,0.12)",
              color: "#2E7D32",
              borderRadius: "10px",
              padding: "4px 8px",
              fontWeight: 500,
            }}
          >
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
            <p className="text-[14px] text-foreground">
              {formatDistanceToNow(parseISO(find.found_at), { addSuffix: true })}
            </p>
          </div>

          {dates.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">Available Dates</p>
              <div className="flex flex-wrap gap-2">
                {dates.sort().map((d) => (
                  <span
                    key={d}
                    className="text-[12px]"
                    style={{
                      background: "rgba(76,175,80,0.12)",
                      color: "#2E7D32",
                      borderRadius: "10px",
                      padding: "4px 8px",
                      fontWeight: 500,
                    }}
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
  const { finds: allFinds, loading } = recentFinds;

  const finds = trackedParkIds && trackedParkIds.size > 0
    ? allFinds.filter((f) => trackedParkIds.has(f.park_id))
    : allFinds;

  const groups = useMemo(() => groupFinds(finds), [finds]);

  const [expanded, setExpanded] = useState(false);
  const [selectedFind, setSelectedFind] = useState<RecentFind | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const visible = expanded ? groups : groups.slice(0, VISIBLE_COUNT);
  const hasMore = groups.length > VISIBLE_COUNT;

  const handleItemClick = (group: GroupedFind) => {
    setSelectedFind(group.mostRecent);
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
      ) : groups.length === 0 ? (
        <div className="py-4 px-3 bg-muted/20 rounded-xl">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {(!trackedParkIds || trackedParkIds.size === 0)
              ? "Start tracking a permit to see recent openings here."
              : "No openings detected yet. The scanner will notify you when availability appears."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((g, idx) => (
              <GroupedFeedItem
                key={g.key}
                group={g}
                staggerIndex={idx}
                onClick={() => handleItemClick(g)}
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
