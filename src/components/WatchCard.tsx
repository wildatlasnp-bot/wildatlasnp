import { useState } from "react";
import { Phone, Clock, Lock, Mail, TrendingUp, Trash2, CalendarCheck, Info, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { getPermitIcon } from "@/lib/parks";
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
  onToggleWatch: (permitName: string) => void;
  onDeleteWatch: (watchId: string) => void;
  onToggleNotify: (watchId: string) => void;
  onTogglePhoneInput: (watchId: string | null) => void;
  onPhoneSaved: (watchId: string) => void;
  onUpgrade: () => void;
  onRefresh?: () => void;
}

const formatLastFind = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "< 1 hour ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const WatchCard = ({
  permit,
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
  onToggleWatch,
  onDeleteWatch,
  onToggleNotify,
  onTogglePhoneInput,
  onPhoneSaved,
  onUpgrade,
}: WatchCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSystemTip, setShowSystemTip] = useState(false);
  const Icon = getPermitIcon(permit.name);
  const isActive = watch?.is_active ?? false;
  const seasonLabel =
    permit.season_start && permit.season_end
      ? `${permit.season_start} – ${permit.season_end}`
      : "";

  return (
    <motion.div
      key={permit.name}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-xl p-5 border transition-all duration-200 ${
        isActive ? "bg-card border-secondary/25" : "bg-card border-border/70"
      }`}
      style={{ boxShadow: isActive ? "var(--card-shadow)" : "none" }}
    >
      <div className="flex items-center gap-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-secondary/10" : "bg-primary/8"}`}>
          <Icon
            size={17}
            className={`${isActive ? "text-secondary" : "text-primary"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] text-foreground font-body leading-snug">{permit.name}</h3>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5 font-medium font-body">{permit.description || seasonLabel}</p>
          {/* Personal find stat */}
          <p className={`text-[11px] mt-1.5 font-body leading-snug ${
            lastFind 
              ? "font-bold text-status-found" 
              : "font-medium text-muted-foreground/50 italic"
          }`}>
            {lastFind ? `Found permit for you · ${formatLastFind(lastFind)}` : "Not yet found for you"}
          </p>

          {/* Separator + system-wide stat */}
          {permit.total_finds > 0 && (
            <>
              <div className="border-t border-border/30 mt-2.5 pt-2 flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] text-status-found font-semibold">
                  <TrendingUp size={9} />
                  {permit.total_finds} found system-wide ↗
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSystemTip((v) => !v); }}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  aria-label="What does system-wide mean?"
                >
                  <Info size={11} />
                </button>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  permit.total_finds > 75
                    ? "bg-status-quiet/15 text-status-quiet"
                    : permit.total_finds >= 25
                    ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {permit.total_finds > 75 ? "Easy" : permit.total_finds >= 25 ? "Moderate" : "Hard"}
                </span>
              </div>
              <AnimatePresence>
                {showSystemTip && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[10px] text-muted-foreground/60 leading-relaxed mt-1.5 pl-0.5"
                  >
                    Total permits found by WildAtlas across all users tracking this permit type this season.
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {watch && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Remove tracking"
            >
              <Trash2 size={14} />
            </button>
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop tracking this permit?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop monitoring <span className="font-medium text-foreground">{permit.name}</span> and remove all associated alerts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteWatch(watch.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Availability from DB */}
      {availability.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <CalendarCheck size={10} className="text-status-found shrink-0" />
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
            <span className="text-[10px] text-muted-foreground">+{availability.length - 5} more</span>
          )}
        </div>
      )}

      {/* Active status indicator */}
      {isActive && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-status-scanning status-dot-pulse" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-scanning" />
          </span>
          <span className="text-[11px] font-bold text-status-scanning uppercase tracking-wider">Scanning</span>
          {watch && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-medium ml-1">
              <Clock size={8} />
              {getTimeAgo(watch.updated_at)}
            </span>
          )}
        </div>
      )}

      {/* Full-width tracking pill button */}
      <button
        onClick={() => onToggleWatch(permit.name)}
        disabled={isLoading}
        className={`w-full mt-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 ${
          isActive
            ? "bg-status-quiet text-white"
            : "bg-transparent border-2 border-status-quiet text-status-quiet hover:bg-status-quiet/10"
        }`}
      >
        {isActive ? "Tracking Active ✓" : "Enable Tracking"}
      </button>

      {/* Inline phone input */}
      <AnimatePresence>
        {watch && isActive && isPro && !hasPhone && showPhoneInput === watch.id && (
          <InlinePhoneInput userId={userId} watchId={watch.id} onPhoneSaved={onPhoneSaved} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WatchCard;