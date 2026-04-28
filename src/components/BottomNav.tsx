import React, { useState, useEffect, useRef } from "react";
import { PawPrint, Bell, Telescope, SlidersHorizontal, type LucideProps } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "rgba(255, 255, 255, 0.55)";
const INACTIVE_LABEL = "rgba(255, 255, 255, 0.50)";
const ACTIVE = "#FFFFFF";

const ACTIVE_COLOR: Record<Tab, string> = {
  mochi: ACTIVE,
  discover: ACTIVE,
  sniper: ACTIVE,
  settings: ACTIVE,
};

type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

const tabs: {
  id: Tab;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { id: "mochi", label: "Poko", ariaLabel: "Poko", Icon: PawPrint },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", Icon: Bell },
  { id: "discover", label: "Discover", ariaLabel: "Discover", Icon: Telescope },
  { id: "settings", label: "Settings", ariaLabel: "Settings", Icon: SlidersHorizontal },
];

const BottomNav = React.memo(({ activeTab, onTabChange, hasUnreadAlerts = false }: BottomNavProps) => {
  const [popTab, setPopTab] = useState<Tab | null>(null);
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (popTimer.current) clearTimeout(popTimer.current); };
  }, []);

  const handleTabClick = (tab: Tab) => {
    if (tab === activeTab) return;
    setPopTab(tab);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPopTab(null), 150);
    onTabChange(tab);
  };

  return (
    <nav
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 76,
        padding: "0 4px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "#1A2F1E",
        borderTop: "0.5px solid rgba(255, 255, 255, 0.08)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPop = popTab === tab.id;
        const color = isActive ? ACTIVE_COLOR[tab.id] : INACTIVE;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              width: 56,
              height: 56,
              gap: 3,
            }}
          >
            <div
              style={{
                position: "relative",
                width: 44,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  transform: isPop ? "scale(1.1)" : "scale(1)",
                  transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isActive ? 1 : 0.85,
                }}
              >
                <tab.Icon size={22} strokeWidth={isActive ? 1.75 : 1.4} color={color} />
              </div>
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 6,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "rgba(245,245,240,0.85)",
                    border: "1.5px solid rgba(5,26,16,0.75)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: isActive ? ACTIVE : INACTIVE_LABEL,
                lineHeight: 1,
                transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
