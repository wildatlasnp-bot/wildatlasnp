import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LiveAlertBanner from "@/components/LiveAlertBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import AuthPage from "@/pages/AuthPage";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover";

const tabComponents: Record<Tab, React.FC> = {
  mochi: MochiChat,
  sniper: SniperDashboard,
  discover: DiscoverTips,
};

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("discover");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const ActiveComponent = tabComponents[activeTab];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      <LiveAlertBanner />
      <main className="flex-1 pt-11 pb-[72px] flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
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
