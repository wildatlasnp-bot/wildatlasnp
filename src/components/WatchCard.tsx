import { useState, useRef, useEffect } from "react";
import { Phone, Lock, Mail, TrendingUp, Trash2, CalendarCheck, Info, AlertTriangle, RefreshCw, Check, CheckCircle } from "lucide-react";
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
  onToggleWatch: (permitName: string, parkId: string) => void;
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
  scannerStale,
  lastChecked,
  scanPulse,
  onToggleWatch,
  onDeleteWatch,
  onToggleNotify,
  onTogglePhoneInput,
  onPhoneSaved,
  onUpgrade,
  onRefresh,
}: WatchCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSystemTip, setShowSystemTip] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const prevLastFind = useRef(lastFind);
  const Icon = getPermitIcon(permit.name);
  const isActive = watch?.is_active ?? false;

  // Detect "initializing" state: watch was created in the last 60 seconds and no scan yet
  const isInitializing = (() => {
    if (!watch || !isActive) return false;
    const createdAt = new Date(watch.updated_at).getTime();
    const age = Date.now() - createdAt;
    return age < 60_000 && watch.status === "searching";
  })();

  const seasonLabel =
    permit.season_start && permit.season_end
      ? `${permit.season_start} – ${permit.season_end}`
      : "";

  // Detect lastFind transition: null/undefined → truthy (found!)
  useEffect(() => {
    if (!prevLastFind.current && lastFind) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 1100);
      return () => clearTimeout(timer);
    }
    prevLastFind.current = lastFind;
  }, [lastFind]);

  // ── Live scan countdown ──
  const SCAN_INTERVAL_MS = 120_000; // 2 minutes
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Detect scan pulse → flash "Scanning now…" for 3s
  const prevScanPulse = useRef(scanPulse);
  useEffect(() => {
    if (scanPulse && !prevScanPulse.current) {
      setIsScanning(true);
      const t = setTimeout(() => setIsScanning(false), 3000);
      prevScanPulse.current = scanPulse;
      return () => clearTimeout(t);
    }
    prevScanPulse.current = scanPulse;
  }, [scanPulse]);

  // Tick countdown every second when active and not initializing
  useEffect(() => {
    if (!isActive || isInitializing || !lastChecked) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - new Date(lastChecked).getTime();
      const remaining = Math.max(0, SCAN_INTERVAL_MS - elapsed);
      if (remaining <= 0) {
        setCountdown(null);
        return;
      }
      const totalSec = Math.ceil(remaining / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setCountdown(m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, isInitializing, lastChecked]);

  const showTimingLine = isActive && !isInitializing && !lastFind && (isScanning || countdown);

  return (
    <motion.div
      key={permit.name}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-[18px] p-5 border border-[#E0E0E0] transition-all duration-200 bg-card ${
        celebrating ? "permit-found-glow" : ""
      }`}
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      {/* Particle burst on found */}
      {celebrating && (
        <div className="permit-found-particles" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="permit-particle" style={{ '--particle-angle': `${i * 45}deg` } as React.CSSProperties} />
          ))}
        </div>
      )}

      {/* Header row: icon + title + delete */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isActive ? "bg-secondary/10" : "bg-primary/8"}`}>
          <Icon
            size={17}
            className={`${isActive ? "text-secondary" : "text-primary"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* 1. Permit title — 16px / 600 */}
          <h3 className="font-semibold text-[16px] text-foreground font-body leading-snug">{permit.name}</h3>

          {/* 2. Permit type — 4px gap from title */}
          <p className="text-[14px] text-foreground/65 font-normal font-body leading-snug mt-1">{permit.description || seasonLabel}</p>
        </div>

        {watch && (
          <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Card body — 8-point grid spacing */}
      <div className="pl-12">
        {/* 3. Status message — 8px from permit type */}
        <p className={`mt-2 text-[15px] font-body leading-snug ${
          lastFind
            ? "font-semibold text-status-found"
            : !isActive
              ? "font-normal text-foreground/50"
              : isInitializing
                ? "font-medium text-secondary"
                : "font-medium text-[#333333]"
        }`}>
          {lastFind ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle
                size={13}
                className={`shrink-0 ${celebrating ? "permit-found-check" : ""}`}
              />
              Permit available — act now
            </span>
          ) : !isActive ? (
            "Tracking paused"
          ) : isInitializing ? (
            "Starting scanner…"
          ) : (
            "Scanning for availability"
          )}
        </p>

        {/* Subtext for initializing state */}
        {isActive && isInitializing && !lastFind && (
          <p className="mt-1 text-[13px] text-foreground/60 font-normal font-body">
            Checking for cancellations every 2 minutes
          </p>
        )}

        {/* Live scanner timing line */}
        {showTimingLine && (
          <p className="mt-1 text-[13px] text-foreground/60 font-normal font-body leading-snug">
            {isScanning ? "Scanning now…" : `Next scan in ${countdown}`}
          </p>
        )}

        {/* 4. Activity insight — 8px from status */}
        {permit.total_finds > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-[13px] text-foreground/65 font-normal">
                <TrendingUp size={11} className="shrink-0" />
                {permit.total_finds} openings detected this week
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSystemTip((v) => !v); }}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="What does this mean?"
              >
                <Info size={11} />
              </button>
            </div>
            <AnimatePresence>
              {showSystemTip && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[12px] text-foreground/65 font-normal leading-relaxed mt-1"
                >
                  Total permit openings detected by WildAtlas across all users tracking this permit type in the last 7 days.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 5. Tracking badge — 12px from activity */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`inline-flex rounded-full h-2 w-2 shrink-0 ${isActive ? "bg-[#2E7D32]" : "bg-[#9E9E9E]"}`} />
          <span className={`text-[13px] font-medium select-none ${isActive ? "text-[#2E7D32]" : "text-[#9E9E9E]"}`}>
            {isActive ? "Tracking active" : "Tracking paused"}
          </span>
        </div>
      </div>

      {/* Availability from DB */}
      {availability.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pl-12">
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
            <span className="text-[10px] text-muted-foreground font-normal">+{availability.length - 5} more</span>
          )}
        </div>
      )}

      {/* Stale data warning */}
      {scannerStale && isActive && (
        <div className="mt-4 flex items-center gap-2 pt-4 border-t border-border/30 pl-12">
          <AlertTriangle size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[10px] font-normal text-amber-700 dark:text-amber-300">Data may be outdated</span>
          {onRefresh && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw size={10} />
              Refresh
            </button>
          )}
        </div>
      )}

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