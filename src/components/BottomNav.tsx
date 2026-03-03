import { MessageCircle, Crosshair, Map } from "lucide-react";
import { motion } from "framer-motion";

type Tab = "mochi" | "sniper" | "discover";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: "mochi" as Tab, label: "Mochi", icon: MessageCircle },
  { id: "sniper" as Tab, label: "Sniper", icon: Crosshair },
  { id: "discover" as Tab, label: "Discover", icon: Map },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-nav safe-bottom border-t border-white/5">
      <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-nav-active"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.6}
                className={`transition-colors ${isActive ? "text-nav-active" : "text-nav-foreground"}`}
              />
              <span
                className={`text-[10px] font-medium tracking-wide transition-colors ${
                  isActive ? "text-nav-active" : "text-nav-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
