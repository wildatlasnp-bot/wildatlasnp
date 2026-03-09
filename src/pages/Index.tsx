import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import OfflineBanner from "@/components/OfflineBanner";
import DeletionBanner from "@/components/DeletionBanner";
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

const TAB_STORAGE_KEY = "wildatlas_active_tab";
const TAB_ORDER: Tab[] = ["mochi", "sniper", "discover"];

const Index = () => {
  const { user, loading, scheduledDeletionAt, clearDeletionSchedule } = useAuth();
  const { refreshProStatus } = useProStatus();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
    return saved && TAB_ORDER.includes(saved) ? saved : "sniper";
  });
  const [prevTab, setPrevTab] = useState<Tab | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(() => {
    return localStorage.getItem("wildatlas_onboarded") === "true";
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [savedOnboardingStep, setSavedOnboardingStep] = useState(0);
  const [parkId, setParkId] = useState(
    () => localStorage.getItem("wildatlas_active_park") || DEFAULT_PARK_ID
  );

  // Scroll position refs per tab
  const scrollRefs = useRef<Record<Tab, number>>({ mochi: 0, sniper: 0, discover: 0 });
  const tabContainerRefs = useRef<Record<Tab, HTMLDivElement | null>>({ mochi: null, sniper: null, discover: null });

  // Directional slide: determine if incoming tab is to the right or left
  const getDirection = useCallback((from: Tab, to: Tab): number => {
    return TAB_ORDER.indexOf(to) - TAB_ORDER.indexOf(from);
  }, []);

  // Handle checkout success/cancel query params
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const tab = searchParams.get("tab");
    if (tab === "sniper" || tab === "discover" || tab === "mochi") {
      setActiveTab(tab);
      localStorage.setItem(TAB_STORAGE_KEY, tab);
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

  // Check onboarding state — skip DB query if localStorage confirms completion
  useEffect(() => {
    if (!user) {
      setOnboardingChecked(true);
      return;
    }
    if (localStorage.getItem("wildatlas_onboarded") === "true") {
      setNeedsOnboarding(false);
      setOnboardingChecked(true);
      return;
    }
    supabase
      .from("profiles")
      .select("onboarded_at, onboarding_step_reached")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const completed = !!data?.onboarded_at;
        if (completed) localStorage.setItem("wildatlas_onboarded", "true");
        setSavedOnboardingStep(data?.onboarding_step_reached ?? 0);
        setNeedsOnboarding(!completed);
        setOnboardingChecked(true);
      });
  }, [user]);

  const handleParkChange = useCallback((id: string) => {
    setParkId(id);
    localStorage.setItem("wildatlas_active_park", id);
  }, []);

  // Persist active tab & save/restore scroll positions
  const handleTabChange = useCallback((tab: Tab) => {
    if (tab === activeTab) return;

    // Save current scroll position
    const currentContainer = tabContainerRefs.current[activeTab];
    if (currentContainer) {
      const scrollEl = currentContainer.querySelector("[data-tab-scroll]");
      if (scrollEl) scrollRefs.current[activeTab] = scrollEl.scrollTop;
    }

    setPrevTab(activeTab);
    setActiveTab(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);

    // Restore target scroll position after paint
    requestAnimationFrame(() => {
      const targetContainer = tabContainerRefs.current[tab];
      if (targetContainer) {
        const scrollEl = targetContainer.querySelector("[data-tab-scroll]");
        if (scrollEl) scrollEl.scrollTop = scrollRefs.current[tab];
      }
    });
  }, [activeTab]);

  // Compute direction for CSS custom property
  const direction = prevTab ? getDirection(prevTab, activeTab) : 0;
  const slideSign = direction >= 0 ? 1 : -1;

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
        initialStep={savedOnboardingStep}
        onComplete={(initialTab) => {
          localStorage.setItem("wildatlas_onboarded", "true");
          setNeedsOnboarding(false);
          if (initialTab) setActiveTab(initialTab);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">
      <OfflineBanner />
      {scheduledDeletionAt && (
        <DeletionBanner
          scheduledDeletionAt={scheduledDeletionAt}
          onCancelDeletion={clearDeletionSchedule}
        />
      )}
        {TAB_ORDER.map((tab) => {
          const isActive = activeTab === tab;
          const isLeaving = prevTab === tab && !isActive;
          return (
            <div
              key={tab}
              ref={(el) => { tabContainerRefs.current[tab] = el; }}
              onAnimationEnd={() => {
                if (isLeaving) setPrevTab(null);
              }}
              className={`tab-pane ${
                isActive
                  ? "tab-pane-enter"
                  : isLeaving
                    ? "tab-pane-exit"
                    : "tab-pane-hidden"
              }`}
              style={
                isActive
                  ? { '--tab-slide-x': `${slideSign * 7}px` } as React.CSSProperties
                  : isLeaving
                    ? { '--tab-slide-x': `${-slideSign * 7}px` } as React.CSSProperties
                    : undefined
              }
              aria-hidden={!isActive}
              {...(!isActive && { inert: "" as unknown as boolean })}
            >
              {/* Mochi: independent assistant, reads global tracked permits */}
              {tab === "mochi" && <MochiChat onNavigateToDiscover={(parkId) => { handleParkChange(parkId); handleTabChange("discover"); }} />}
              {/* Alerts: global monitoring dashboard, no park context */}
              {tab === "sniper" && <SniperDashboard />}
              {/* Discover: park-specific exploration with header */}
              {tab === "discover" && (
                <>
                  <ParkStatusHeader parkId={parkId} />
                  <DiscoverTips parkId={parkId} onParkChange={handleParkChange} onNavigateToSniper={() => handleTabChange("sniper")} />
                </>
              )}
            </div>
          );
        })}
      </main>
      <footer className="px-4 py-3 pb-[110px] text-center space-y-1">
        <p className="text-[11px] text-muted-foreground/80 font-body">
          © 2026 WildAtlas. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <Link to="/privacy" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">Privacy Policy</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/terms" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">Terms of Service</Link>
        </div>
      </footer>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => {
        posthog.capture("tab_viewed", { tab });
        handleTabChange(tab);
      }} />
    </div>
  );
};

export default Index;
