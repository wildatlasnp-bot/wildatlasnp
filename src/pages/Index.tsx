import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import OfflineBanner from "@/components/OfflineBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import OnboardingFlow from "@/components/OnboardingFlow";
import ParkStatusHeader from "@/components/ParkStatusHeader";
import { Loader2 } from "lucide-react";
import { DEFAULT_PARK_ID } from "@/lib/parks";
import posthog from "@/lib/posthog";

type Tab = "mochi" | "sniper" | "discover";

const Index = () => {
  const { user, loading } = useAuth();
  const { refreshProStatus } = useProStatus();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("sniper");
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [parkId, setParkId] = useState(
    () => localStorage.getItem("wildatlas_active_park") || DEFAULT_PARK_ID
  );

  // Handle checkout success/cancel query params
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const tab = searchParams.get("tab");
    if (tab === "sniper" || tab === "discover" || tab === "mochi") {
      setActiveTab(tab);
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
    }
    if (checkout === "success") {
      toast({ title: "🎉 Welcome to Pro!", description: "Your subscription is active. Enjoy unlimited watches!" });
      refreshProStatus();
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    } else if (checkout === "cancelled") {
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  // Check onboarding state from DB
  useEffect(() => {
    if (!user) {
      setOnboardingChecked(true);
      return;
    }
    supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.onboarded_at);
        setOnboardingChecked(true);
      });
  }, [user]);

  const handleParkChange = (id: string) => {
    setParkId(id);
    localStorage.setItem("wildatlas_active_park", id);
  };

  if (loading || !onboardingChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (user && needsOnboarding) {
    return (
      <OnboardingFlow
        userId={user.id}
        onComplete={(initialTab) => {
          setNeedsOnboarding(false);
          if (initialTab) setActiveTab(initialTab);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      <OfflineBanner />
      <main className="flex-1 pb-4 flex flex-col overflow-hidden">
        <ParkStatusHeader parkId={parkId} />
        <div className={activeTab === "mochi" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
          <MochiChat parkId={parkId} onParkChange={handleParkChange} />
        </div>
        <div className={activeTab === "sniper" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
          <SniperDashboard parkId={parkId} onParkChange={handleParkChange} />
        </div>
        <div className={activeTab === "discover" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
          <DiscoverTips parkId={parkId} onParkChange={handleParkChange} onNavigateToSniper={() => setActiveTab("sniper")} />
        </div>
      </main>
      <footer className="px-4 py-3 pb-[110px] text-center space-y-1">
        <p className="text-[11px] text-muted-foreground/80 font-body">
          © 2026 WildAtlas. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <Link to="/privacy" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">Privacy Policy</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/terms" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">Terms of Service</Link>
          <span className="text-muted-foreground/40">·</span>
          <a href="https://wildatlasnp.lovable.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">WildAtlas.com</a>
        </div>
      </footer>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => {
        posthog.capture("tab_viewed", { tab });
        setActiveTab(tab);
      }} />
    </div>
  );
};

export default Index;
