import { MessageCircle, Crosshair, Map, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

type Tab = "mochi" | "sniper" | "discover";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  settingsActive?: boolean;
}

const tabs = [
  { id: "mochi" as Tab, label: "Mochi", icon: MessageCircle },
  { id: "sniper" as Tab, label: "Sniper", icon: Crosshair },
  { id: "discover" as Tab, label: "Discover", icon: Map },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-nav safe-bottom border-t border-border/40">
      <div className="flex items-center justify-center gap-10 h-[48px] max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
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
                  className="absolute -top-[11px] left-1/2 -translate-x-1/2 w-7 h-[2px] rounded-full bg-nav-active"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                size={17}
                strokeWidth={isActive ? 1.8 : 1.3}
                className={`transition-colors ${isActive ? "text-nav-active" : "text-nav-foreground"}`}
              />
              <span
                className={`text-[9px] font-medium tracking-wide transition-colors ${
                  isActive ? "text-nav-active" : "text-nav-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => navigate("/settings")}
          className="relative flex flex-col items-center justify-center gap-0.5 transition-all"
        >
          <Settings
            size={17}
            strokeWidth={1.3}
            className="transition-colors text-nav-foreground"
          />
          <span className="text-[9px] font-medium tracking-wide transition-colors text-nav-foreground">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
