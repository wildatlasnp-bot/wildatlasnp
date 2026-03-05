import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSniperData } from "@/hooks/useSniperData";
import SniperHeader from "@/components/SniperHeader";
import SniperStats from "@/components/SniperStats";
import WatchCard from "@/components/WatchCard";
import PermitSuccessOverlay from "@/components/PermitSuccessOverlay";
import ProModal from "@/components/ProModal";
import PermitFeed from "@/components/PermitFeed";
import ParkAlerts from "@/components/ParkAlerts";

interface SniperProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
}

const SniperDashboard = ({ parkId: parkIdProp, onParkChange }: SniperProps = {}) => {
  const navigate = useNavigate();
  const s = useSniperData(parkIdProp, onParkChange);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 1. Scanner status + park selector */}
      <SniperHeader
        parkId={s.parkId}
        activeCount={s.activeCount}
        lastChecked={s.lastChecked}
        scanPulse={s.scanPulse}
        refreshing={s.refreshing}
        getTimeAgo={s.getTimeAgo}
        onParkChange={s.handleParkChange}
        onRefresh={s.fetchAvailability}
      />

      {/* 2. Large stat row: Watching | Alerts On | Found */}
      <SniperStats
        isPro={s.isPro}
        FREE_WATCH_LIMIT={s.FREE_WATCH_LIMIT}
        activeCount={s.activeCount}
        alertCount={s.alertCount}
        foundCount={s.foundCount}
        totalAvailDates={s.totalAvailDates}
        permitDefs={s.permitDefs}
        watches={s.watches}
        getAvailability={s.getAvailability}
        onUpgrade={() => s.setProModalOpen(true)}
      />

      {/* 3. Activity feed — permit discoveries */}
      <PermitFeed parkId={s.parkId} />

      {/* 4. Park alerts */}
      <ParkAlerts parkId={s.parkId} />

      {/* 5. Watch cards */}
      <div className="px-5 space-y-3 pb-6">
        <p className="section-header">Permit Watches</p>
        {s.permitDefs.map((permit, i) => (
          <div key={permit.name} id={`permit-card-${permit.name}`}>
            <WatchCard
              permit={permit}
              watch={s.getWatchState(permit.name)}
              availability={s.getAvailability(permit.name)}
              index={i}
              isLoading={s.loadingId === permit.name}
              hasPhone={s.hasPhone}
              isPro={s.isPro}
              userId={s.user?.id ?? ""}
              showPhoneInput={s.showPhoneInput}
              getTimeAgo={s.getTimeAgo}
              onToggleWatch={s.toggleWatch}
              onDeleteWatch={s.deleteWatch}
              onToggleNotify={s.toggleNotify}
              onTogglePhoneInput={s.setShowPhoneInput}
              onPhoneSaved={s.handlePhoneSaved}
              onUpgrade={() => s.setProModalOpen(true)}
            />
          </div>
        ))}

        {!s.user && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-secondary/30 bg-secondary/10 text-secondary py-3 text-[12px] font-semibold hover:bg-secondary/20 transition-colors"
          >
            <LogIn size={14} />
            Sign up to start watching permits
          </motion.button>
        )}
      </div>

      <PermitSuccessOverlay
        open={s.successOpen}
        onClose={() => s.setSuccessOpen(false)}
        permitName={s.foundPermit?.name}
        permitDate={s.foundPermit?.date}
      />
      <ProModal open={s.proModalOpen} onOpenChange={s.setProModalOpen} />
    </div>
  );
};

export default SniperDashboard;
