import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "#3A3F3A";
const ACTIVE = "#2F6F4E";
const SW = 3.5;

/* ── Bear Paw Mark ── */
const PokoIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Main pad */}
      <circle cx="12" cy="14.5" r="5" fill={c}/>
      {/* Toe pads */}
      <circle cx="7" cy="7.5" r="2.2" fill={c}/>
      <circle cx="11" cy="5.5" r="2.2" fill={c}/>
      <circle cx="17" cy="7.5" r="2.2" fill={c}/>
    </svg>
  );
};

/* ── Sonar Pulse ── */
const AlertsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Core */}
      <circle cx="12" cy="18" r="3" fill={c}/>
      {/* Inner band */}
      <path d="M7 12.5A5.5 5.5 0 0 1 17 12.5" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
      {/* Outer band */}
      <path d="M3.5 8A9.5 9.5 0 0 1 20.5 8" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
    </svg>
  );
};

/* ── Compass ── */
const DiscoverIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Ring */}
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth={SW} fill="none"/>
      {/* Diamond needle */}
      <path d="M12 3.5L14.5 12L12 20.5L9.5 12Z" fill={c}/>
    </svg>
  );
};

/* ── Sliders ── */
const SettingsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="3" y1="8" x2="21" y2="8" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <circle cx="8" cy="8" r="3" fill={c}/>
      <line x1="3" y1="16" x2="21" y2="16" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <circle cx="16" cy="16" r="3" fill={c}/>
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
        padding: "16px 0 24px",
        background: "#F0EDEA",
        borderTop: "0.5px solid rgba(0,0,0,0.06)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isPop = popTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              transform: isPop ? "scale(1.06)" : "scale(1)",
              transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
            }}
          >
            {tab.icon(activeTab === tab.id)}
            {tab.id === "sniper" && hasUnreadAlerts && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: ACTIVE,
                  border: "2px solid #F0EDEA",
                  pointerEvents: "none",
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
