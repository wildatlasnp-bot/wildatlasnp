import React from "react";
import { MessageCircle, Bell, Map, Settings } from "lucide-react";
import { motion } from "framer-motion";
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
              className="relative flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -top-[13px] left-1/2 -translate-x-1/2 w-7 h-[2px] rounded-full bg-nav-active"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
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
            </button>
          );
        })}
        <button
          onClick={() => navigate("/settings")}
          className="relative flex flex-col items-center justify-center gap-0.5 transition-all"
        >
          {settingsActive && (
            <motion.div
              layoutId="nav-pill"
              className="absolute -top-[13px] left-1/2 -translate-x-1/2 w-7 h-[2px] rounded-full bg-nav-active"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <Settings
            size={18}
            strokeWidth={settingsActive ? 1.6 : 1.2}
            className={`transition-colors ${settingsActive ? "text-nav-active" : "text-nav-foreground"}`}
          />
          <span className={`text-[9px] font-medium tracking-wide transition-colors ${settingsActive ? "text-nav-active" : "text-nav-foreground"}`}>
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
