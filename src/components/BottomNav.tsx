import React, { useState, useEffect, useRef } from "react";
import { Telescope } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const DM_SANS = "'DM Sans', sans-serif";

const INACTIVE = "#9CA3AF";
const ACTIVE = "#2F6F4E";

const MochiIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Crown — short rounded dome */}
      <path d="M8.5 13C8.5 11.5 9.5 10 10.5 9.2C11.1 8.7 11.5 8.5 12 8.5C12.5 8.5 12.9 8.7 13.5 9.2C14.5 10 15.5 11.5 15.5 13" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Top crease — subtle pinch */}
      <path d="M11.2 9C11.5 8.6 11.7 8.5 12 8.5C12.3 8.5 12.5 8.6 12.8 9" stroke={s} strokeWidth="1.2" strokeLinecap="round"/>
      {/* Hat band */}
      <line x1="7" y1="13" x2="17" y2="13" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Wide brim */}
      <path d="M2.5 15.5C2.5 14.2 6.5 13 12 13C17.5 13 21.5 14.2 21.5 15.5C21.5 16.8 17.5 18 12 18C6.5 18 2.5 16.8 2.5 15.5Z" stroke={s} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
};

const AlertsIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C9 3 6.5 5.5 6.5 8.5C6.5 12.5 5 14.5 4 16H20C19 14.5 17.5 12.5 17.5 8.5C17.5 5.5 15 3 12 3Z" stroke={s} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 16H20" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 3V1.5" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};

const DiscoverIcon = ({ active }: { active: boolean }) => (
  <Telescope size={24} strokeWidth={1.5} color={active ? ACTIVE : INACTIVE} fill="none" />
);

const SettingsIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7.5h16M4 12h16M4 16.5h16" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8.5" cy="7.5" r="2" fill="#F0EDEA" stroke={s} strokeWidth="1.5"/>
      <circle cx="15.5" cy="12" r="2" fill="#F0EDEA" stroke={s} strokeWidth="1.5"/>
      <circle cx="10" cy="16.5" r="2" fill="#F0EDEA" stroke={s} strokeWidth="1.5"/>
    </svg>
  );
};

const tabs: {
  id: Tab;
  label: string;
  ariaLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  { id: "mochi", label: "Poko", ariaLabel: "Poko chat", icon: (a) => <MochiIcon active={a} /> },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", icon: (a) => <AlertsIcon active={a} /> },
  { id: "discover", label: "Discover", ariaLabel: "Discover", icon: (a) => <DiscoverIcon active={a} /> },
  { id: "settings", label: "Settings", ariaLabel: "Settings", icon: (a) => <SettingsIcon active={a} /> },
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
        alignItems: "flex-start",
        padding: "14px 4px 22px",
        background: "#F0EDEA",
        borderTop: "0.5px solid rgba(0,0,0,0.06)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPop = popTab === tab.id;
        const strokeColor = isActive ? "#2F6F4E" : "#9CA3AF";

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Icon area */}
            <div
              style={{
                position: "relative",
                width: 44,
                minWidth: 44,
                height: 36,
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
                }}
              >
                {tab.icon(isActive)}
              </div>
              {/* Alert badge */}
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 2,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#2F6F4E",
                    border: "1.5px solid #F0EDEA",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {/* Label */}
             <span
               style={{
                 fontFamily: DM_SANS,
                  fontSize: isActive ? 13 : 12,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "#2F6F4E" : INACTIVE,
                 lineHeight: 1,
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
