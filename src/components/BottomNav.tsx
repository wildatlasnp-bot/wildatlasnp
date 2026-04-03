import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const DM_SANS = "'DM Sans', sans-serif";

const MochiIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    {/* Bear face outline */}
    <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5" />
    {/* Ears */}
    <circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="17.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    {/* Eyes */}
    <circle cx="9.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="14.5" cy="12" r="1.2" fill="currentColor" />
    {/* Nose */}
    <ellipse cx="12" cy="15" rx="1.5" ry="1" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const AlertsIcon = ({ stroke }: { stroke: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3C9 3 6.5 5.5 6.5 8.5C6.5 12.5 5 14.5 4 16H20C19 14.5 17.5 12.5 17.5 8.5C17.5 5.5 15 3 12 3Z"
      stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"
    />
    <path d="M4 16H20" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16"
      stroke={stroke} strokeWidth="1.5" strokeLinecap="round"
    />
    <path d="M12 3V1.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DiscoverIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M4 5L9 7L15 5L20 7V19L15 17L9 19L4 17V5Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 7V19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
    <path d="M15 5V17" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
  </svg>
);

const SettingsIcon = ({ stroke }: { stroke: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth="1.5" />
    <path
      d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.6 5.6L7 7M17 17L18.4 18.4M18.4 5.6L17 7M7 17L5.6 18.4"
      stroke={stroke} strokeWidth="1.5" strokeLinecap="round"
    />
  </svg>
);

const tabs: {
  id: Tab;
  label: string;
  ariaLabel: string;
  icon: (color: string) => React.ReactNode;
  
}[] = [
  { id: "mochi", label: "Poko", ariaLabel: "Poko chat", icon: (c) => <MochiIcon color={c} /> },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", icon: (c) => <AlertsIcon stroke={c} /> },
  { id: "discover", label: "Discover", ariaLabel: "Discover", icon: (c) => <DiscoverIcon color={c} /> },
  { id: "settings", label: "Settings", ariaLabel: "Settings", icon: (c) => <SettingsIcon stroke={c} /> },
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
                {tab.icon(strokeColor)}
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
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#2F6F4E" : "#9CA3AF",
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
