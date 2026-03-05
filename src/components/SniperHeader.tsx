import { CalendarIcon, Clock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import ParkSelector from "@/components/ParkSelector";

interface SniperHeaderProps {
  parkId: string;
  activeCount: number;
  lastChecked: string | null;
  scanPulse: boolean;
  refreshing: boolean;
  getTimeAgo: (dateStr: string) => string;
  onParkChange: (id: string) => void;
  onRefresh: () => void;
}

const SniperHeader = ({
  parkId, activeCount, lastChecked, scanPulse, refreshing,
  getTimeAgo, onParkChange, onRefresh,
}: SniperHeaderProps) => {
  const arrivalDateStr = localStorage.getItem("wildatlas_arrival_date");
  const arrivalDate = arrivalDateStr ? new Date(arrivalDateStr) : null;

  return (
    <div className="px-5 pt-4 pb-2">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium text-secondary tracking-widest uppercase">Permit Sniper</p>
        <ParkSelector activeParkId={parkId} onParkChange={onParkChange} />
        {activeCount > 0 && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
            Live
          </span>
        )}
      </div>
      <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">Active Watches</h1>
      <p className="text-sm text-muted-foreground mt-1">We'll ping you when a slot opens.</p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {arrivalDate && (
          <div className="flex items-center gap-1.5 text-xs text-secondary font-medium">
            <CalendarIcon size={12} />
            <span>Trip: {format(arrivalDate, "MMMM d, yyyy")}</span>
          </div>
        )}
        {lastChecked && (
          <motion.div
            key={lastChecked}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-1.5 text-[11px] transition-colors duration-700 ${scanPulse ? "text-secondary" : "text-muted-foreground"}`}
          >
            <Clock size={10} />
            <span>Last scan: {getTimeAgo(lastChecked)}</span>
          </motion.div>
        )}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-secondary transition-colors disabled:opacity-50"
          aria-label="Refresh availability"
        >
          <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Scanning…" : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
};

export default SniperHeader;
