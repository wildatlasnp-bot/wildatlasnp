import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import OfflineBanner from "@/components/OfflineBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import OnboardingFlow from "@/components/OnboardingFlow";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { DEFAULT_PARK_ID } from "@/lib/parks";

type Tab = "mochi" | "sniper" | "discover";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("sniper");
  const [parkId, setParkId] = useState(
    () => localStorage.getItem("wildatlas_active_park") || DEFAULT_PARK_ID
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("wildatlas_onboarded")
  );

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  const handleParkChange = (id: string) => {
    setParkId(id);
    localStorage.setItem("wildatlas_active_park", id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) return null;

  if (showOnboarding) {
    return <OnboardingFlow userId={user.id} onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 pb-[72px] flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {activeTab === "mochi" && <MochiChat parkId={parkId} />}
            {activeTab === "sniper" && <SniperDashboard parkId={parkId} onParkChange={handleParkChange} />}
            {activeTab === "discover" && <DiscoverTips parkId={parkId} onParkChange={handleParkChange} />}
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
