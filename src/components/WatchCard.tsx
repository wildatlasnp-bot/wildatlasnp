import { useState } from "react";
import { Phone, Clock, Lock, Mail, TrendingUp, Trash2, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
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
  index: number;
  isLoading: boolean;
  hasPhone: boolean;
  isPro: boolean;
  userId: string;
  showPhoneInput: string | null;
  getTimeAgo: (dateStr: string) => string;
  onToggleWatch: (permitName: string) => void;
  onDeleteWatch: (watchId: string) => void;
  onToggleNotify: (watchId: string) => void;
  onTogglePhoneInput: (watchId: string | null) => void;
  onPhoneSaved: (watchId: string) => void;
  onUpgrade: () => void;
}

const WatchCard = ({
  permit,
  watch,
  availability = [],
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
      className={`rounded-xl p-5 border transition-colors ${
        isActive ? "bg-card border-secondary/30" : "bg-card border-border"
      }`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isActive ? "bg-secondary/20 text-secondary" : "bg-primary/8 text-primary"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[13px] text-foreground font-body">{permit.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-body">{permit.description || seasonLabel}</p>
          {permit.total_finds > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-status-found font-semibold mt-1">
              <TrendingUp size={9} />
              {permit.total_finds} found this season
            </span>
          )}
        </div>

        {/* Availability from DB */}
        {availability.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CalendarCheck size={10} className="text-secondary mt-0.5 shrink-0" />
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
        <div className="flex items-center gap-1.5">
          {watch && (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete watch"
              >
                <Trash2 size={14} />
              </button>
              <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this watch?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop monitoring <span className="font-medium text-foreground">{permit.name}</span> and delete all associated alerts.
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
            </>
          )}
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggleWatch(permit.name)}
            disabled={isLoading}
            className="data-[state=checked]:bg-secondary"
          />
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border/50">
        <AnimatePresence mode="wait">
          {isActive ? (
            <motion.div key="live" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-scanning" />
              </span>
              <span className="text-[10px] font-bold text-status-scanning uppercase tracking-wider">Monitoring…</span>
              {watch && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-medium ml-1">
                  <Clock size={8} />
                  {getTimeAgo(watch.updated_at)}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.span key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Inactive
            </motion.span>
          )}
        </AnimatePresence>
        {watch && isActive ? (
          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <span className="text-[11px] text-muted-foreground">SMS</span>
                {!hasPhone ? (
                  <button
                    onClick={() => onTogglePhoneInput(showPhoneInput === watch.id ? null : watch.id)}
                    className="text-[9px] text-secondary font-semibold flex items-center gap-0.5 hover:underline"
                  >
                    <Phone size={8} />
                    Add phone
                  </button>
                ) : null}
                <Switch
                  checked={watch.notify_sms}
                  onCheckedChange={() => {
                    if (!hasPhone) {
                      onTogglePhoneInput(watch.id);
                      return;
                    }
                    onToggleNotify(watch.id);
                  }}
                  className="data-[state=checked]:bg-secondary"
                />
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Mail size={10} />
                  Email alert
                </span>
                <span className="text-[9px] text-secondary/70">✓</span>
                <button
                  onClick={onUpgrade}
                  className="text-[9px] text-secondary font-semibold flex items-center gap-0.5 hover:underline ml-1"
                >
                  <Lock size={7} />
                  SMS
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mail size={10} />
              Alerts
            </span>
            <Switch checked={false} disabled className="opacity-40" />
          </div>
        )}
      </div>

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
