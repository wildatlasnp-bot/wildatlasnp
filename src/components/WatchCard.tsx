import { useState, useRef, useEffect } from "react";
import { TrendingUp, Trash2, CheckCircle, Info, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { getParkConfig } from "@/lib/parks";
import { type ScannerState } from "@/lib/scanner-status";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Watch {
  id: string;
  permit_name: string;
  park_id: string;
  status: string;
  is_active: boolean;
  notify_sms: boolean;
  updated_at: string;
}

export interface PermitDef {
  name: string;
  description: string | null;
  season_start: string | null;
  season_end: string | null;
  total_finds: number;
  recgov_permit_id?: string | null;
}

export interface PermitAvailabilityRow {
  id: string;
  park_code: string;
  permit_type: string;
  date: string;
  available_spots: number;
  last_checked: string;
}

interface WatchCardProps {
  permit: PermitDef;
  parkId: string;
  watch: Watch | undefined;
  availability?: PermitAvailabilityRow[];
  lastFind?: string | null;
  index: number;
  isLoading: boolean;
  hasPhone: boolean;
  isPro: boolean;
  userId: string;
  showPhoneInput: string | null;
  getTimeAgo: (dateStr: string) => string;
  scannerStale?: boolean;
  lastChecked?: string | null;
  scanPulse?: boolean;
  scannerState?: ScannerState;
  onToggleWatch: (permitName: string, parkId: string) => void;
  onDeleteWatch: (watchId: string) => void;
  onToggleNotify: (watchId: string) => void;
  onTogglePhoneInput: (watchId: string | null) => void;
  onPhoneSaved: (watchId: string) => void;
  onUpgrade: () => void;
  onRefresh?: () => void;
}

// Scanner status dot configs matching ScannerStatusCard
type DotConfig = { dotClass: string; ping: boolean; pulse: boolean };
const DOT_CONFIG: Record<ScannerState, DotConfig> = {
  active:   { dotClass: "bg-status-quiet",       ping: true,  pulse: false },
  starting: { dotClass: "bg-yellow-400",          ping: false, pulse: true  },
  delayed:  { dotClass: "bg-status-busy",         ping: false, pulse: true  },
  paused:   { dotClass: "bg-muted-foreground/50", ping: false, pulse: false },
  error:    { dotClass: "bg-status-peak",         ping: false, pulse: true  },
};

const STATUS_LABEL: Record<ScannerState, string> = {
  active:   "Scanning for availability",
  starting: "Starting scanner…",
  delayed:  "Scanner paused",
  paused:   "Scanner paused",
  error:    "Scanner error",
};

const STATUS_LABEL_COLOR: Record<ScannerState, string> = {
  active:   "text-status-quiet",
  starting: "text-yellow-500",
  delayed:  "text-status-busy",
  paused:   "text-muted-foreground",
  error:    "text-status-peak",
};

const METADATA_TEXT: Record<ScannerState, string | null> = {
  active:   null, // will be computed dynamically
  starting: null,
  delayed:  "Resume scanning in Settings",
  paused:   "Resume scanning in Settings",
  error:    "Retrying in 2 minutes…",
};

const ActivityInsight = ({ totalFinds }: { totalFinds: number }) => {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const tipText = "Total permits opened across all users tracking this permit type in the last 7 days.";

  return (
    <div className="flex items-center gap-1.5">
      <TrendingUp size={11} className="text-muted-foreground/70 shrink-0" />
      <span className="text-[12px] text-muted-foreground/70 font-normal">
        {totalFinds} permits opened in the last 7 days
      </span>
      {isMobile ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
            className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            aria-label="What does this mean?"
          >
            <Info size={12} />
          </button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl bg-background p-0">
              <SheetHeader className="px-5 pt-5 pb-3">
                <SheetTitle className="text-[15px]">Permit Activity</SheetTitle>
              </SheetHeader>
              <SheetDescription className="px-5 pb-5 text-[13px] font-normal text-muted-foreground leading-relaxed">
                {tipText}
              </SheetDescription>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                aria-label="What does this mean?"
              >
                <Info size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[240px] bg-background text-muted-foreground text-[13px] font-normal p-3 shadow-md border border-border"
            >
              {tipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

const WatchCard = ({
  permit,
  parkId,
  watch,
  availability = [],
  lastFind,
  index,
  isLoading,
  getTimeAgo,
  lastChecked,
  scannerState = "active",
  onDeleteWatch,
}: WatchCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const prevLastFind = useRef(lastFind);
  const isMobile = useIsMobile();
  const parkConfig = getParkConfig(parkId);
  
  const isActive = watch?.is_active ?? false;

  // Detect "initializing" state: watch was created in the last 60 seconds
  const isInitializing = (() => {
    if (!watch || !isActive) return false;
    const createdAt = new Date(watch.updated_at).getTime();
    const age = Date.now() - createdAt;
    return age < 60_000 && watch.status === "searching";
  })();

  // Determine effective scanner state for this card
  const effectiveState: ScannerState = !isActive
    ? "paused"
    : isInitializing
      ? "starting"
      : scannerState;

  const dot = DOT_CONFIG[effectiveState];
  const statusLabel = lastFind ? null : STATUS_LABEL[effectiveState];
  const statusLabelColor = STATUS_LABEL_COLOR[effectiveState];

  // Build metadata line
  const metadataText = (() => {
    if (lastFind) return null;
    if (!isActive) return METADATA_TEXT.paused;
    if (isInitializing) return null;
    if (effectiveState === "error") return METADATA_TEXT.error;
    if (effectiveState === "delayed" || effectiveState === "paused") return METADATA_TEXT.paused;
    // Active state: show last checked
    if (effectiveState === "active" && lastChecked) {
      return `Last checked ${getTimeAgo(lastChecked)}`;
    }
    return null;
  })();

  // Detect lastFind transition: null/undefined → truthy (found!)
  useEffect(() => {
    if (!prevLastFind.current && lastFind) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 1100);
      return () => clearTimeout(timer);
    }
    prevLastFind.current = lastFind;
  }, [lastFind]);

  const seasonLabel =
    permit.season_start && permit.season_end
      ? `${permit.season_start} – ${permit.season_end}`
      : null;

  const handleCardClick = () => {
    setDetailOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const recGovUrl = permit.recgov_permit_id
    ? `https://www.recreation.gov/permits/${permit.recgov_permit_id}`
    : null;

  return (
    <>
      <motion.div
        key={permit.name}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.2 }}
        onClick={handleCardClick}
        className={`rounded-[18px] p-4 border border-border/60 bg-card cursor-pointer permit-card-press transition-shadow hover:shadow-md ${
          celebrating ? "permit-found-glow" : ""
        }`}
        style={{ boxShadow: "var(--card-shadow)" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
        aria-label={`View details for ${permit.name}`}
      >
        {/* Particle burst on found */}
        {celebrating && (
          <div className="permit-found-particles" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="permit-particle" style={{ '--particle-angle': `${i * 45}deg` } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Row 1: Permit name + delete icon */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-[16px] text-foreground font-body leading-tight flex-1 min-w-0">
            {permit.name}
          </h3>
          {watch && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 -mr-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              aria-label="Stop tracking"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Row 2: Park name + optional subtype */}
        <p className="text-[13px] text-muted-foreground font-normal leading-snug mt-1">
          {parkConfig.shortName}
          {permit.description && ` · ${permit.description}`}
        </p>

        {/* Row 3: Scanner state (second strongest element) */}
        {lastFind ? (
          <div className="flex items-center gap-2 mt-3">
            <CheckCircle
              size={14}
              className={`text-status-found shrink-0 ${celebrating ? "permit-found-check" : ""}`}
            />
            <span className="text-[14px] font-semibold text-status-found leading-snug">
              Availability detected
            </span>
          </div>
        ) : statusLabel && (
          <div className="flex items-center gap-2 mt-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              {dot.ping && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                  style={{ animationDuration: "1.6s" }}
                />
              )}
              {dot.pulse && (
                <span
                  className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot.dotClass}`} />
            </span>
            <span className={`text-[14px] font-medium leading-snug ${statusLabelColor}`}>
              {statusLabel}
            </span>
          </div>
        )}

        {/* Row 4: Metadata (lowest contrast) */}
        {metadataText && (
          <p className="text-[12px] text-muted-foreground/60 font-normal leading-snug mt-1.5 pl-[18px]">
            {metadataText}
          </p>
        )}

        {/* Optional: Activity insight (only if data exists) */}
        {permit.total_finds > 0 && (
          <div className="mt-3">
            <ActivityInsight totalFinds={permit.total_finds} />
          </div>
        )}

        {/* Available dates chips */}
        {availability.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {availability.slice(0, 5).map((a) => (
              <span
                key={a.id}
                className="text-[10px] font-semibold bg-status-found/10 text-status-found px-1.5 py-0.5 rounded"
              >
                {format(new Date(a.date + "T00:00:00"), "MMM d")}
                {a.available_spots > 1 && ` (${a.available_spots})`}
              </span>
            ))}
            {availability.length > 5 && (
              <span className="text-[10px] text-muted-foreground font-normal">+{availability.length - 5} more</span>
            )}
          </div>
        )}
      </motion.div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking {permit.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the permit from monitoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => watch && onDeleteWatch(watch.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop Tracking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permit detail sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "rounded-t-2xl max-h-[85vh] overflow-y-auto" : "w-[400px]"}
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="text-[18px] font-bold text-foreground">{permit.name}</SheetTitle>
            <SheetDescription className="text-[14px] text-muted-foreground">
              {parkConfig.name}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5">
            {/* Description */}
            {permit.description && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Description</p>
                <p className="text-[14px] text-foreground leading-relaxed">{permit.description}</p>
              </div>
            )}

            {/* Season */}
            {seasonLabel && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Season</p>
                <p className="text-[14px] text-foreground">{seasonLabel}</p>
              </div>
            )}

            {/* Scanner state */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">Scanner Status</p>
              <div className="flex items-center gap-2">
                {lastFind ? (
                  <>
                    <CheckCircle size={14} className="text-status-found" />
                    <span className="text-[14px] font-semibold text-status-found">Permit available</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                      {dot.ping && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`} style={{ animationDuration: "1.6s" }} />
                      )}
                      {dot.pulse && (
                        <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot.dotClass}`} />
                    </span>
                    <span className={`text-[14px] font-medium ${statusLabelColor}`}>{statusLabel}</span>
                  </>
                )}
              </div>
              {metadataText && (
                <p className="text-[12px] text-muted-foreground/60 mt-1 pl-[18px]">{metadataText}</p>
              )}
            </div>

            {/* Activity insights */}
            {permit.total_finds > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Recent Activity</p>
                <div className="flex items-center gap-2 text-[14px] text-foreground">
                  <TrendingUp size={14} className="text-muted-foreground" />
                  {permit.total_finds} permits found in the last 7 days
                </div>
              </div>
            )}

            {/* Available dates */}
            {availability.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">Available Dates</p>
                <div className="flex flex-wrap gap-2">
                  {availability.map((a) => (
                    <span
                      key={a.id}
                      className="text-[12px] font-semibold bg-status-found/10 text-status-found px-2 py-1 rounded-md"
                    >
                      {format(new Date(a.date + "T00:00:00"), "MMM d, yyyy")}
                      {a.available_spots > 1 && ` · ${a.available_spots} spots`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recreation.gov link */}
            {recGovUrl && (
              <a
                href={recGovUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] hover:bg-primary/90 transition-colors"
              >
                <ExternalLink size={14} />
                Book on Recreation.gov
              </a>
            )}

            {/* Stop tracking button */}
            {watch && (
              <button
                onClick={() => {
                  setDetailOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full py-3 rounded-xl border border-destructive/30 text-destructive font-medium text-[14px] hover:bg-destructive/10 transition-colors"
              >
                Stop Tracking
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default WatchCard;
