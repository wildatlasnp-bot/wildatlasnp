import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "#404040";
const ACTIVE_ICON = "#FFFFFF";
const BAR_BG = "#0A0A0A";
const SW = 2;

/* ── Geometric Paw ── */
const PokoIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="15.5" r="4.5" fill={c}/>
      <circle cx="6.5" cy="8" r="2" fill={c}/>
      <circle cx="12" cy="6" r="2" fill={c}/>
      <circle cx="17.5" cy="8" r="2" fill={c}/>
    </svg>
  );
};

/* ── Radar ── */
const AlertsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="19" r="2.5" fill={c}/>
      <path d="M7.5 13A5 5 0 0 1 16.5 13" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
      <path d="M4 8.5A9 9 0 0 1 20 8.5" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
    </svg>
  );
};

/* ── Compass ── */
const DiscoverIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M12 4L14 12L12 20L10 12Z" fill={c}/>
    </svg>
  );
};

/* ── Sliders with square toggles ── */
const SettingsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="3" y1="8" x2="21" y2="8" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" fill={c}/>
      <line x1="3" y1="16" x2="21" y2="16" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <rect x="13.5" y="13.5" width="5" height="5" rx="0.5" fill={c}/>
    </svg>
  );
};

const tabs: {
  id: Tab;
  ariaLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  { id: "mochi", ariaLabel: "Poko", icon: (a) => <PokoIcon active={a} /> },
  { id: "sniper", ariaLabel: "Alerts", icon: (a) => <AlertsIcon active={a} /> },
  { id: "discover", ariaLabel: "Discover", icon: (a) => <DiscoverIcon active={a} /> },
  { id: "settings", ariaLabel: "Settings", icon: (a) => <SettingsIcon active={a} /> },
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
    popTimer.current = window.setTimeout(() => setPopTab(null), 120);
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
        padding: "12px 0 24px",
        background: BAR_BG,
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPop = popTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 48,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              position: "relative",
            }}
          >
            {/* Active indicator — 1px white line 4px above icon */}
            <span
              style={{
                width: 16,
                height: 1,
                background: isActive ? ACTIVE_ICON : "transparent",
                marginBottom: 4,
              }}
            />
            {/* Icon */}
            <div
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: isPop ? "scale(1.04)" : "scale(1)",
                transition: "transform 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
              }}
            >
              {tab.icon(isActive)}
              {tab.id === "sniper" && hasUnreadAlerts && !isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: -1,
                    right: -3,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#2F6F4E",
                    border: `1.5px solid ${BAR_BG}`,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
