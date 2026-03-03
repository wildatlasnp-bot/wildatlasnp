import { useState } from "react";
import LiveAlertBanner from "@/components/LiveAlertBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import { AnimatePresence, motion } from "framer-motion";

type Tab = "mochi" | "sniper" | "discover";

const tabComponents: Record<Tab, React.FC> = {
  mochi: MochiChat,
  sniper: SniperDashboard,
  discover: DiscoverTips,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("discover");

  const ActiveComponent = tabComponents[activeTab];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      <LiveAlertBanner />

      <main className="flex-1 pt-12 pb-20 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
