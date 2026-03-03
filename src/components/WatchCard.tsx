import { Phone, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { getPermitIcon } from "@/lib/parks";
import InlinePhoneInput from "@/components/InlinePhoneInput";

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
}

interface WatchCardProps {
  permit: PermitDef;
  watch: Watch | undefined;
  index: number;
  isLoading: boolean;
  hasPhone: boolean;
  userId: string;
  showPhoneInput: string | null;
  getTimeAgo: (dateStr: string) => string;
  onToggleWatch: (permitName: string) => void;
  onToggleNotify: (watchId: string) => void;
  onTogglePhoneInput: (watchId: string | null) => void;
  onPhoneSaved: (watchId: string) => void;
}

const WatchCard = ({
  permit,
  watch,
  index,
  isLoading,
  hasPhone,
  userId,
  showPhoneInput,
  getTimeAgo,
  onToggleWatch,
  onToggleNotify,
  onTogglePhoneInput,
  onPhoneSaved,
}: WatchCardProps) => {
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
      className={`rounded-xl p-4 border transition-colors ${
        isActive ? "bg-secondary/10 border-secondary/30" : "bg-card border-border"
      }`}
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
          <h3 className="font-semibold text-[13px] text-foreground">{permit.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{permit.description || seasonLabel}</p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={() => onToggleWatch(permit.name)}
          disabled={isLoading}
          className="data-[state=checked]:bg-secondary"
        />
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border/50">
        <AnimatePresence mode="wait">
          {isActive ? (
            <motion.div key="live" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
              </span>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Monitoring…</span>
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
            <span className="text-[11px] text-muted-foreground">SMS</span>
            {!hasPhone && (
              <button
                onClick={() => onTogglePhoneInput(showPhoneInput === watch.id ? null : watch.id)}
                className="text-[9px] text-secondary font-semibold flex items-center gap-0.5 hover:underline"
              >
                <Phone size={8} />
                Add phone
              </button>
            )}
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
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">SMS</span>
            <Switch checked={false} disabled className="opacity-40" />
          </div>
        )}
      </div>

      {/* Inline phone input */}
      <AnimatePresence>
        {watch && isActive && !hasPhone && showPhoneInput === watch.id && (
          <InlinePhoneInput userId={userId} watchId={watch.id} onPhoneSaved={onPhoneSaved} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WatchCard;
