import { useState, useRef, useEffect } from "react";
const mochiCelebrating = "/mochi-celebrate.png";
const mochiWorried = "/mochi-worried.png";
import { TrendingUp, Trash2, CheckCircle, Info, ExternalLink, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { getParkConfig } from "@/lib/parks";
import { type ScannerState } from "@/lib/scanner-status";
import InlinePhoneInput from "@/components/InlinePhoneInput";

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

// Staleness threshold: availability data older than 24 h is considered stale.
// Used in both the preview chips and the expanded sheet — single source of truth.
const STALE_MS = 24 * 60 * 60 * 1000;
const isDateStale = (lastChecked: string | null | undefined): boolean => {
  if (!lastChecked) return false;
  const t = new Date(lastChecked).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t > STALE_MS;
};

// Chip class helpers so preview and sheet use identical visual states.
const chipClass = (lastChecked: string) =>
  isDateStale(lastChecked)
    ? "bg-muted text-muted-foreground/60"
    : "bg-status-found/10 text-status-found";

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
  active:   "Watching",
  starting: "Starting scanner…",
  delayed:  "Checking\u2026",
  paused:   "Paused",
  error:    "Temporarily offline",
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

const MetadataWithTip = ({ text, isOpeningDetected }: { text: string; isOpeningDetected: boolean }) => {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const tipText = "This shows when the scanner last found available dates for this permit — not when the scanner last ran. The scanner runs frequent automated checks regardless.";

  if (!isOpeningDetected) {
    return (
      <p className="font-normal leading-snug mt-1.5 pl-[14px]" style={{ fontSize: 12, color: "#9CA3AF" }}>
        {text}
      </p>
    );
  }

  return (
    <div className="mt-1.5 pl-[14px]">
      <div className="flex items-center gap-1">
        <span className="font-normal leading-snug" style={{ fontSize: 12, color: "#9CA3AF" }}>{text}</span>
        {isMobile ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
              className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
              aria-label="What does this timestamp mean?"
            >
              <Info size={11} />
            </button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent side="bottom" className="rounded-t-2xl bg-background p-0">
                <SheetHeader className="px-5 pt-5 pb-3">
                  <SheetTitle className="text-[15px]">Last Opening Detected</SheetTitle>
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
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                  aria-label="What does this timestamp mean?"
                >
                  <Info size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-[260px] bg-background text-muted-foreground text-[13px] font-normal p-3 shadow-md border border-border"
              >
                {tipText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/40 font-normal leading-snug mt-0.5">
        This permit opens infrequently — timing is unpredictable
      </p>
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
  hasPhone,
  isPro,
  userId,
  showPhoneInput,
  getTimeAgo,
  lastChecked,
  scannerState = "active",
  onDeleteWatch,
  onToggleNotify,
  onTogglePhoneInput,
  onPhoneSaved,
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
      return `Last opening detected ${getTimeAgo(lastChecked)}`;
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
        className={`rounded-[18px] p-4 border border-border/60 cursor-pointer permit-card-press transition-shadow hover:shadow-md relative overflow-hidden ${
          celebrating ? "signal-lock-glow signal-lock-surface" : ""
        } ${effectiveState === "active" ? "permit-scanning-aura" : ""}`}
        style={{ boxShadow: "var(--card-shadow)", backgroundColor: "#F8F7F5" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
        aria-label={`View details for ${permit.name}`}
      >
        {/* Signal Lock: horizontal highlight sweep */}
        {celebrating && (
          <div className="signal-lock-sweep" aria-hidden="true" />
        )}

        {/* Mochi celebrating illustration — delayed final beat */}
        <AnimatePresence>
          {celebrating && (
            <motion.div
              className="flex justify-center mb-2"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [0.9, 1.06, 1], opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.2 }}
              aria-hidden="true"
            >
              <img src={mochiCelebrating} alt="" className="w-12 h-12" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 1: Permit name + season pill + delete icon */}
        {(() => {
          const seasonMatch = permit.name.match(/^(.+?)\s*\((\w+)\)$/);
          const displayName = seasonMatch ? seasonMatch[1] : permit.name;
          const seasonTag = seasonMatch ? seasonMatch[2] : null;
          return (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h3 className="font-semibold text-[16px] text-foreground font-body leading-tight truncate">
                  {displayName}
                </h3>
                {seasonTag && (
                  <span className="shrink-0" style={{ background: "#EAF3DE", color: "#2F6F4E", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {seasonTag}
                  </span>
                )}
              </div>
              {watch && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  onClick={handleDeleteClick}
                  className="p-1.5 -mr-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  aria-label="Stop tracking"
                >
                  <Trash2 size={14} />
                </motion.button>
              )}
            </div>
          );
        })()}

        {/* Row 2: Park pill + permit details */}
        <div className="mt-2 space-y-1">
          <span style={{ background: "#EAF3DE", color: "#2F6F4E", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, display: "inline-block" }}>
            {parkConfig.shortName}
          </span>
          {(permit.description || seasonLabel) && (
            <p style={{ fontSize: 12, color: "#9CA3AF" }} className="leading-snug">
              {[permit.description, seasonLabel].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Row 3: Scanner state — found uses vertical replace animation */}
        {lastFind ? (
          <motion.div
            key={String(!!lastFind)}
            className="flex items-center gap-2 mt-3"
            initial={celebrating ? { y: 6, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <CheckCircle size={14} className="text-status-found shrink-0" />
            <span className="text-[14px] font-semibold text-status-found leading-snug">
              Availability detected
            </span>
          </motion.div>
        ) : statusLabel && (
          <div className="flex items-center mt-3" style={{ gap: 6 }}>
            {effectiveState === "error" ? (
              <img src={mochiWorried} alt="" className="w-5 h-5 object-contain shrink-0" aria-hidden="true" />
            ) : (
              <span className="relative flex shrink-0" style={{ width: 8, height: 8 }} aria-hidden="true">
                {dot.ping && (
                  <>
                    <span className="signal-bloom" />
                    <span className="signal-bloom signal-bloom-delay" />
                  </>
                )}
                {dot.pulse && (
                  <span
                    className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${dot.dotClass} opacity-50`}
                  />
                )}
                <span className={`relative inline-flex rounded-full h-full w-full ${dot.dotClass}`} />
              </span>
            )}
            <span className="text-[13px] font-normal leading-snug" style={{ color: "#4A7C59" }}>
              {statusLabel}
            </span>
          </div>
        )}

        {/* Row 4: Metadata (lowest contrast) */}
        {metadataText && (
          <MetadataWithTip text={metadataText} isOpeningDetected={metadataText.startsWith("Last opening")} />
        )}

        {/* SMS toggle — only shown when watch exists and is active */}
        {watch && watch.is_active && (
          <div className="mt-3 space-y-0">
            <div
              className="flex items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-muted-foreground/70 shrink-0" />
                <span className="text-[12px] text-muted-foreground/70 font-normal">SMS alerts</span>
              </div>
              <Switch
                checked={watch.notify_sms}
                onCheckedChange={() => onToggleNotify(watch.id)}
                className="scale-[0.85]"
                aria-label="Toggle SMS alerts for this permit"
              />
            </div>
            <AnimatePresence>
              {showPhoneInput === watch.id && (
                <InlinePhoneInput
                  userId={userId}
                  watchId={watch.id}
                  onPhoneSaved={onPhoneSaved}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Optional: Activity insight (only if data exists) */}

        {/* Available dates chips */}
        {availability.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {availability.slice(0, 5).map((a) => (
                <span
                  key={a.id}
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${chipClass(a.last_checked)}`}
                >
                  {format(new Date(a.date + "T00:00:00"), "MMM d")}
                  {a.available_spots > 1 && ` (${a.available_spots})`}
                </span>
              ))}
              {availability.length > 5 && (
                <span className="text-[10px] text-muted-foreground font-normal">+{availability.length - 5} more</span>
              )}
            </div>
            {availability.some((a) => isDateStale(a.last_checked)) && (
              <p className="text-[10px] text-muted-foreground/60 font-normal leading-snug pl-0.5">
                This opening may no longer be available — check Recreation.gov to confirm.
              </p>
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
                    <span className="text-[14px] font-semibold text-status-found">Availability detected</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                      {dot.ping && (
                        <>
                          <span className="signal-bloom" />
                          <span className="signal-bloom signal-bloom-delay" />
                        </>
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
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">Available Dates</p>
                <div className="flex flex-wrap gap-2">
                  {availability.map((a) => (
                    <span
                      key={a.id}
                      className={`text-[12px] font-semibold px-2 py-1 rounded-md ${chipClass(a.last_checked)}`}
                    >
                      {format(new Date(a.date + "T00:00:00"), "MMM d, yyyy")}
                      {a.available_spots > 1 && ` · ${a.available_spots} spots`}
                    </span>
                  ))}
                </div>
                {availability.some((a) => isDateStale(a.last_checked)) && (
                  <p className="text-[11px] text-muted-foreground/60 font-normal leading-snug">
                    This opening may no longer be available — check Recreation.gov to confirm.
                  </p>
                )}
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
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                onClick={() => {
                  setDetailOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full py-3 rounded-xl border border-destructive/30 text-destructive font-medium text-[14px] hover:bg-destructive/10 transition-colors"
              >
                Stop Tracking
              </motion.button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default WatchCard;
