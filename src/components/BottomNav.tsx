import React from "react";
import { MessageCircle, Bell, Map, Settings } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: "mochi" as Tab, label: "Mochi", icon: MessageCircle, subtitle: null },
  { id: "sniper" as Tab, label: "Alerts", icon: Bell, subtitle: "Permit tracker" },
  { id: "discover" as Tab, label: "Discover", icon: Map, subtitle: null },
  { id: "settings" as Tab, label: "Settings", icon: Settings, subtitle: null },
];

const BottomNav = React.memo(({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-nav/95 backdrop-blur-sm safe-bottom border-t border-border/25">
      <div className="flex items-center justify-center gap-10 h-[56px] max-w-lg mx-auto py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center transition-all"
            >
              <div
                className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] px-[10px] py-[6px] transition-[background-color] duration-150"
                style={{ backgroundColor: isActive ? "rgba(60,120,80,0.10)" : "transparent" }}
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 1.8 : 1.2}
                  className={`transition-colors ${isActive ? "text-nav-active" : "text-nav-foreground/40"}`}
                />
                <span
                  className={`text-[9px] tracking-wide transition-colors leading-tight ${
                    isActive ? "text-nav-active font-semibold" : "text-nav-foreground/40 font-medium"
                  }`}
                >
                  {tab.label}
                </span>
                {tab.subtitle && (
                  <span className={`text-[7px] font-medium tracking-wide transition-colors leading-tight ${
                    isActive ? "text-nav-active/60" : "text-nav-foreground/50"
                  }`}>
                    {tab.subtitle}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
