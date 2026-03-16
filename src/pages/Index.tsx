import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";

import OfflineBanner from "@/components/OfflineBanner";
import DeletionBanner from "@/components/DeletionBanner";
import BottomNav from "@/components/BottomNav";
import MochiChat from "@/components/MochiChat";
import SniperDashboard from "@/components/SniperDashboard";
import DiscoverTips from "@/components/DiscoverTips";
import OnboardingFlow from "@/components/OnboardingFlow";
import ParkStatusHeader from "@/components/ParkStatusHeader";
import SettingsPage from "@/pages/SettingsPage";
import { Loader2 } from "lucide-react";
import { DEFAULT_PARK_ID } from "@/lib/parks";
import posthog from "@/lib/posthog";
import { startTabSwitch } from "@/lib/perf-telemetry";

type Tab = "mochi" | "sniper" | "discover" | "settings";

const TAB_STORAGE_KEY = "wildatlas_active_tab";
const TAB_ORDER: Tab[] = ["mochi", "sniper", "discover", "settings"];
const CONTENT_TABS: Tab[] = ["mochi", "sniper", "discover"];

const MochiTab = memo(function MochiTab({
  onNavigateToDiscover,
  onNavigateToAlerts,
}: {
  onNavigateToDiscover: (parkId: string) => void;
  onNavigateToAlerts: () => void;
}) {
  return (
    <MochiChat
      onNavigateToDiscover={onNavigateToDiscover}
      onNavigateToAlerts={onNavigateToAlerts}
    />
  );
});

const SniperTab = memo(function SniperTab() {
  return <SniperDashboard />;
});

const DiscoverTab = memo(function DiscoverTab({
  parkId,
  onParkChange,
  onNavigateToSniper,
}: {
  parkId: string;
  onParkChange: (parkId: string) => void;
  onNavigateToSniper: () => void;
}) {
  return (
    <DiscoverTips
      parkId={parkId}
      onParkChange={onParkChange}
      onNavigateToSniper={onNavigateToSniper}
    />
  );
});

const SettingsTab = memo(function SettingsTab() {
  return <SettingsPage embedded />;
});

const Index = () => {
  const {
    user,
    ready,
    scheduledDeletionAt,
    clearDeletionSchedule,
    needsOnboarding,
    onboardingStep,
    markOnboardingComplete,
  } = useAuth();

  // Once the dashboard has rendered, lock it — never fall back to loading/onboarding
  // screens due to background profile refetches or auth token refreshes.
  const dashboardRenderedRef = useRef(false);
  const { refreshProStatus } = useProStatus();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab === "mochi" || urlTab === "sniper" || urlTab === "discover" || urlTab === "settings") return urlTab;
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
    return saved && CONTENT_TABS.includes(saved as any) ? saved : "sniper";
  });
  const [prevTab, setPrevTab] = useState<Tab | null>(null);
  const initialVisited = (() => {
    try {
      const stored = sessionStorage.getItem("wildatlas_visited_tabs");
      if (stored) return JSON.parse(stored) as Tab[];
    } catch {}
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab === "mochi" || urlTab === "sniper" || urlTab === "discover") return [urlTab] as Tab[];
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
    return [(saved && TAB_ORDER.includes(saved) ? saved : "sniper")] as Tab[];
  })();
  const visitedTabsRef = useRef<Set<Tab>>(new Set<Tab>(initialVisited));
  // Keep non-active tabs unmounted on initial load to avoid cross-tab mount stutter
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(() => new Set<Tab>([activeTab]));
  const [parkId, setParkId] = useState(
    () => localStorage.getItem("wildatlas_active_park") || DEFAULT_PARK_ID
  );
  const activeTabRef = useRef<Tab>(activeTab);

  // Ensure the active tab is always mounted (covers direct setActiveTab paths)
  useEffect(() => {
    activeTabRef.current = activeTab;
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    const warmTimer = window.setTimeout(() => {
      setMountedTabs((prev) => {
        const next = new Set(prev);
        next.add("mochi");
        next.add("discover");
        next.add("sniper");
        next.add("settings");
        return next.size === prev.size ? prev : next;
      });
    }, 250);

    return () => window.clearTimeout(warmTimer);
  }, []);

  // Scroll position refs per tab
  const scrollRefs = useRef<Record<Tab, number>>({ mochi: 0, sniper: 0, discover: 0, settings: 0 });
  const tabContainerRefs = useRef<Record<Tab, HTMLDivElement | null>>({ mochi: null, sniper: null, discover: null, settings: null });



  // Handle checkout success/cancel query params
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const tab = searchParams.get("tab");
    if (tab === "sniper" || tab === "discover" || tab === "mochi" || tab === "settings") {
      setActiveTab(tab);
      if (tab !== "settings") localStorage.setItem(TAB_STORAGE_KEY, tab);
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

  const handleParkChange = useCallback((id: string) => {
    setParkId(id);
    localStorage.setItem("wildatlas_active_park", id);
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    const currentTab = activeTabRef.current;
    if (tab === currentTab) return;

    // Save current scroll position
    const currentContainer = tabContainerRefs.current[currentTab];
    if (currentContainer) {
      const scrollEl = currentContainer.querySelector("[data-tab-scroll]");
      if (scrollEl) scrollRefs.current[currentTab] = scrollEl.scrollTop;
    }

    const isFirstVisit = !visitedTabsRef.current.has(tab);
    visitedTabsRef.current.add(tab);
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    try { sessionStorage.setItem("wildatlas_visited_tabs", JSON.stringify([...visitedTabsRef.current])); } catch {}

    setPrevTab(isFirstVisit ? currentTab : null);

    activeTabRef.current = tab;
    setActiveTab(tab);
    if (tab !== "settings") localStorage.setItem(TAB_STORAGE_KEY, tab);

    // Restore target scroll position after paint
    requestAnimationFrame(() => {
      const targetContainer = tabContainerRefs.current[tab];
      if (targetContainer) {
        const scrollEl = targetContainer.querySelector("[data-tab-scroll]");
        if (scrollEl) scrollEl.scrollTop = scrollRefs.current[tab];
      }
    });
  }, []);

  const handleNavigateToDiscover = useCallback((id: string) => {
    handleParkChange(id);
    handleTabChange("discover");
  }, [handleParkChange, handleTabChange]);

  const handleNavigateToSniper = useCallback(() => {
    handleTabChange("sniper");
  }, [handleTabChange]);




  // Gate: wait until auth + profile + onboarding are fully resolved (first render only).
  // Once the dashboard has rendered, never fall back to loading/onboarding gates —
  // background refetches and token refreshes must not disrupt the active session.
  if (!dashboardRenderedRef.current) {
    if (!ready) {
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
          initialStep={onboardingStep}
          onComplete={(initialTab) => {
            markOnboardingComplete();
            if (initialTab) setActiveTab(initialTab);
          }}
        />
      );
    }

    // Past this point, lock the dashboard view
    dashboardRenderedRef.current = true;
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
      <main className="flex-1 pb-4 flex flex-col relative">
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
                  ? (prevTab ? "tab-pane-enter" : "tab-pane-active")
                  : isLeaving
                    ? "tab-pane-exit"
                    : "tab-pane-hidden"
              }`}
              aria-hidden={!isActive}
            >
              {mountedTabs.has(tab) && (
                <>
                  {tab === "mochi" && (
                    <MochiTab
                      onNavigateToDiscover={handleNavigateToDiscover}
                      onNavigateToAlerts={handleNavigateToSniper}
                    />
                  )}
                  {tab === "sniper" && <SniperTab />}
                  {tab === "discover" && (
                    <DiscoverTab
                      parkId={parkId}
                      onParkChange={handleParkChange}
                      onNavigateToSniper={handleNavigateToSniper}
                    />
                  )}
                  {tab === "settings" && <SettingsTab />}
                </>
              )}
            </div>
          );
        })}
      </main>
      {activeTab !== "settings" && activeTab !== "mochi" && (
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
      )}
      <BottomNav activeTab={activeTab} onTabChange={(tab) => {
        const endMeasure = startTabSwitch(activeTab, tab);
        posthog.capture("tab_viewed", { tab });
        handleTabChange(tab);
        requestAnimationFrame(() => requestAnimationFrame(endMeasure));
      }} />
    </div>
  );
};

export default Index;
