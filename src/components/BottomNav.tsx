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
    <path d="M12 3C7.2 3 3 7 3 12C3 17 7.2 21 12 21C17 21 21 17 21 12"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M17.5 2.5H21.5V6.5"
      stroke="#C9A96E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21.5 2.5L14.5 9.5"
      stroke="#C9A96E" strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2.2" fill="currentColor"/>
    <path d="M12 9.8V8M12 16V14.2M9.8 12H8M16 12H14.2"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

const AlertsIcon = ({ stroke }: { stroke: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3C9 3 6.5 5.5 6.5 8.5C6.5 12.5 5 14.5 4 16H20C19 14.5 17.5 12.5 17.5 8.5C17.5 5.5 15 3 12 3Z"
      stroke={stroke} strokeWidth="1.6" strokeLinejoin="round"
    />
    <path d="M4 16H20" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16"
      stroke={stroke} strokeWidth="1.5" strokeLinecap="round"
    />
    <path d="M12 3V1.5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DiscoverIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M3 19L7.5 11L11.5 15L16 7.5L21 19H3Z"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 19H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M16 7.5V5" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M16 5H20" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 5V8" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SettingsIcon = ({ stroke }: { stroke: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth="1.6" />
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
  hasAmber?: boolean;
}[] = [
  { id: "mochi", label: "Mochi", ariaLabel: "Mochi chat", icon: (c) => <MochiIcon color={c} />, hasAmber: true },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", icon: (c) => <AlertsIcon stroke={c} /> },
  { id: "discover", label: "Discover", ariaLabel: "Discover", icon: (c) => <DiscoverIcon color={c} />, hasAmber: true },
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
        const strokeColor = isActive ? "#ffffff" : "#8A9A93";

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
            {/* Pill */}
            <div
              style={{
                position: "relative",
                width: 58,
                minWidth: 58,
                height: 38,
                borderRadius: 19,
                background: isActive ? "#2F6F4E" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms ease-out",
              }}
            >
              <div
                style={{
                  transform: isPop ? "scale(1.1)" : "scale(1)",
                  transition: "transform 150ms ease-out",
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
                    top: 5,
                    right: 9,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#C9543A",
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
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#2F6F4E" : "#6A7B73",
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
