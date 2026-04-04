import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const DM_SANS = "'DM Sans', sans-serif";

const INACTIVE = "#6B6860";

const MochiIcon = ({ active }: { active: boolean }) => active ? (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="15" rx="5.5" ry="4.5" fill="#2F6F4E" fillOpacity="0.12" stroke="#2F6F4E" strokeWidth="1.5" strokeLinecap="round"/>
    <ellipse cx="8" cy="9.5" rx="1.8" ry="2.3" fill="#2F6F4E" stroke="#2F6F4E" strokeWidth="1.5"/>
    <ellipse cx="12" cy="8" rx="1.8" ry="2.3" fill="#2F6F4E" stroke="#2F6F4E" strokeWidth="1.5"/>
    <ellipse cx="16" cy="9.5" rx="1.8" ry="2.3" fill="#2F6F4E" stroke="#2F6F4E" strokeWidth="1.5"/>
  </svg>
) : (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="15" rx="5.5" ry="4.5" stroke={INACTIVE} strokeWidth="1.5" strokeLinecap="round"/>
    <ellipse cx="8" cy="9.5" rx="1.8" ry="2.3" stroke={INACTIVE} strokeWidth="1.5"/>
    <ellipse cx="12" cy="8" rx="1.8" ry="2.3" stroke={INACTIVE} strokeWidth="1.5"/>
    <ellipse cx="16" cy="9.5" rx="1.8" ry="2.3" stroke={INACTIVE} strokeWidth="1.5"/>
  </svg>
);

const AlertsIcon = ({ active }: { active: boolean }) => {
  const s = active ? "#2F6F4E" : INACTIVE;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C9 3 6.5 5.5 6.5 8.5C6.5 12.5 5 14.5 4 16H20C19 14.5 17.5 12.5 17.5 8.5C17.5 5.5 15 3 12 3Z" stroke={s} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 16H20" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 3V1.5" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};

const DiscoverIcon = ({ active }: { active: boolean }) => {
  const s = active ? "#2F6F4E" : INACTIVE;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="8" stroke={s} strokeWidth="1.5"/>
      <path d="M14 8l-2 5-2-2-5 2 2-5 2 2 5-2z" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const SettingsIcon = ({ active }: { active: boolean }) => {
  const s = active ? "#2F6F4E" : INACTIVE;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 7h14M4 11h14M4 15h14" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="7" r="2" fill="var(--background)" stroke={s} strokeWidth="1.5"/>
      <circle cx="14" cy="11" r="2" fill="var(--background)" stroke={s} strokeWidth="1.5"/>
      <circle cx="9" cy="15" r="2" fill="var(--background)" stroke={s} strokeWidth="1.5"/>
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
