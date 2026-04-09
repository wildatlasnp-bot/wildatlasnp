import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "#6A756A";
const ACTIVE_ICON = "#FFFFFF";
const ACTIVE_DOT = "#2F6F4E";
const BAR_BG = "#121A12";
const SW = 3.5;

/* ── Bear Paw — solid stamp ── */
const PokoIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="14" r="5.5" fill={c}/>
      <circle cx="6.5" cy="7" r="2.8" fill={c}/>
      <circle cx="11" cy="4.5" r="2.8" fill={c}/>
      <circle cx="15.8" cy="5.2" r="2.8" fill={c}/>
      <circle cx="19" cy="8.5" r="2.8" fill={c}/>
    </svg>
  );
};

/* ── Sonar Pulse ── */
const AlertsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="18" r="3" fill={c}/>
      <path d="M7 12.5A5.5 5.5 0 0 1 17 12.5" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
      <path d="M3.5 7.5A9.5 9.5 0 0 1 20.5 7.5" stroke={c} strokeWidth={SW} strokeLinecap="round" fill="none"/>
    </svg>
  );
};

/* ── Compass ── */
const DiscoverIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth={SW} fill="none"/>
      <path d="M12 4.5L14.2 12L12 19.5L9.8 12Z" fill={c}/>
    </svg>
  );
};

/* ── Sliders ── */
const SettingsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE_ICON : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="2.5" y1="8" x2="21.5" y2="8" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
      <circle cx="8" cy="8" r="3" fill={c}/>
      <line x1="2.5" y1="16" x2="21.5" y2="16" stroke={c} strokeWidth={SW} strokeLinecap="round"/>
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
        padding: "14px 0 22px",
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
              justifyContent: "center",
              gap: 0,
              width: 52,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              position: "relative",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: isPop ? "scale(1.05)" : "scale(1)",
                transition: "transform 120ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {tab.icon(isActive)}
              {tab.id === "sniper" && hasUnreadAlerts && !isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: ACTIVE_DOT,
                    border: `2px solid ${BAR_BG}`,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {/* Active glow dot */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isActive ? ACTIVE_DOT : "transparent",
                marginTop: 6,
                boxShadow: isActive ? `0 0 6px 1px ${ACTIVE_DOT}` : "none",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
