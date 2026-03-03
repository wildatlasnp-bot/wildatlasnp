import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LiveAlertBanner from "@/components/LiveAlertBanner";
import OfflineBanner from "@/components/OfflineBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import OnboardingFlow from "@/components/OnboardingFlow";
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
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("wildatlas_onboarded")
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

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
      <footer className="pb-[72px] px-4 py-3 text-center space-y-1">
        <p className="text-[11px] text-muted-foreground/70 font-body">
          © 2026 WildAtlas. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <a href="/privacy" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">Privacy Policy</a>
          <span className="text-muted-foreground/30">·</span>
          <a href="/terms" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">Terms of Service</a>
        </div>
      </footer>
      <OfflineBanner />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
