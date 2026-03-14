import React from "react";
import { MessageCircle, Bell, Map, Settings } from "lucide-react";

import { useNavigate } from "react-router-dom";

type Tab = "mochi" | "sniper" | "discover";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  settingsActive?: boolean;
}

const tabs = [
  { id: "mochi" as Tab, label: "Mochi", icon: MessageCircle, subtitle: null },
  { id: "sniper" as Tab, label: "Alerts", icon: Bell, subtitle: "Permit tracker" },
  { id: "discover" as Tab, label: "Discover", icon: Map, subtitle: null },
];

const BottomNav = React.memo(({ activeTab, onTabChange, settingsActive }: BottomNavProps) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-nav safe-bottom border-t border-border/40">
      <div className="flex items-center justify-center gap-10 h-[56px] max-w-lg mx-auto py-1">
        {tabs.map((tab) => {
          const isActive = !settingsActive && activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center transition-all"
            >
              <div
                className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] px-[10px] py-[6px] transition-[background-color] duration-150"
                style={{ backgroundColor: isActive ? "rgba(60,120,80,0.08)" : "transparent" }}
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 1.6 : 1.2}
                  className={`transition-colors ${isActive ? "text-nav-active" : "text-nav-foreground"}`}
                />
                <span
                  className={`text-[9px] font-medium tracking-wide transition-colors leading-tight ${
                    isActive ? "text-nav-active" : "text-nav-foreground"
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
        <button
          onClick={() => navigate("/settings")}
          className="relative flex flex-col items-center justify-center transition-all"
        >
          <div
            className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] px-[10px] py-[6px] transition-[background-color] duration-150"
            style={{ backgroundColor: settingsActive ? "rgba(60,120,80,0.08)" : "transparent" }}
          >
            <Settings
              size={18}
              strokeWidth={settingsActive ? 1.6 : 1.2}
              className={`transition-colors ${settingsActive ? "text-nav-active" : "text-nav-foreground"}`}
            />
            <span className={`text-[9px] font-medium tracking-wide transition-colors ${settingsActive ? "text-nav-active" : "text-nav-foreground"}`}>
              Settings
            </span>
          </div>
        </button>
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
