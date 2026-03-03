import { MessageCircle, ShieldCheck, Compass } from "lucide-react";
import { motion } from "framer-motion";

type Tab = "mochi" | "sniper" | "discover";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: "mochi" as Tab, label: "Mochi", icon: MessageCircle },
  { id: "sniper" as Tab, label: "Sniper", icon: ShieldCheck },
  { id: "discover" as Tab, label: "Discover", icon: Compass },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-nav safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-nav-active"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={22}
                className={isActive ? "text-nav-active" : "text-nav-foreground opacity-60"}
              />
              <span
                className={`text-[11px] font-medium ${
                  isActive ? "text-nav-active" : "text-nav-foreground opacity-60"
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
