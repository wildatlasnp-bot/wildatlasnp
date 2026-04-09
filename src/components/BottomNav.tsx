import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "#8E978E";
const ACTIVE = "#2F6F4E";
const SW = 2.5;
const CAP = "round" as const;
const JOIN = "round" as const;

/* ── Bear Head ── */
const PokoIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Left ear */}
      <circle cx="7.5" cy="7" r="2.5" stroke={s} strokeWidth={SW} fill={active ? s : "none"} strokeLinecap={CAP} strokeLinejoin={JOIN}/>
      {/* Right ear */}
      <circle cx="16.5" cy="7" r="2.5" stroke={s} strokeWidth={SW} fill={active ? s : "none"} strokeLinecap={CAP} strokeLinejoin={JOIN}/>
      {/* Head */}
      <ellipse cx="12" cy="13.5" rx="6" ry="5.5" stroke={s} strokeWidth={SW} fill={active ? s : "none"} strokeLinecap={CAP} strokeLinejoin={JOIN}/>
      {/* Snout */}
      <ellipse cx="12" cy="15" rx="2.2" ry="1.6" stroke={active ? "#F0EDEA" : s} strokeWidth={1.8} fill={active ? "#F0EDEA" : "none"} strokeLinecap={CAP}/>
      {/* Nose */}
      <ellipse cx="12" cy="14.4" rx="1" ry="0.7" fill={active ? s : s}/>
    </svg>
  );
};

/* ── Signal Wave ── */
const AlertsIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Center dot */}
      <circle cx="12" cy="17" r="2" stroke={s} strokeWidth={SW} fill={active ? s : "none"} strokeLinecap={CAP}/>
      {/* Inner arc */}
      <path d="M8 13C9 11.2 10.4 10 12 10C13.6 10 15 11.2 16 13" stroke={s} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JOIN} fill="none"/>
      {/* Outer arc */}
      <path d="M5 9.5C7 6.5 9.3 5 12 5C14.7 5 17 6.5 19 9.5" stroke={s} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JOIN} fill="none"/>
    </svg>
  );
};

/* ── Compass Needle ── */
const DiscoverIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Outer ring */}
      <circle cx="12" cy="12" r="9" stroke={s} strokeWidth={SW} fill="none" strokeLinecap={CAP}/>
      {/* Compass diamond — NE filled, SW outline */}
      <path d="M12 5.5L14.5 12L12 18.5L9.5 12Z" stroke={s} strokeWidth={SW} strokeLinejoin={JOIN} fill="none"/>
      <path d="M12 5.5L14.5 12L12 12L9.5 12Z" fill={active ? s : "none"} stroke="none"/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill={s}/>
    </svg>
  );
};

/* ── Technical Sliders ── */
const SettingsIcon = ({ active }: { active: boolean }) => {
  const s = active ? ACTIVE : INACTIVE;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Line 1 */}
      <line x1="4" y1="8" x2="20" y2="8" stroke={s} strokeWidth={SW} strokeLinecap={CAP}/>
      <circle cx="8.5" cy="8" r="2" stroke={s} strokeWidth={SW} fill={active ? s : "#F0EDEA"} strokeLinecap={CAP}/>
      {/* Line 2 */}
      <line x1="4" y1="16" x2="20" y2="16" stroke={s} strokeWidth={SW} strokeLinecap={CAP}/>
      <circle cx="15.5" cy="16" r="2" stroke={s} strokeWidth={SW} fill={active ? s : "#F0EDEA"} strokeLinecap={CAP}/>
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
        padding: "16px 4px 24px",
        background: "#F0EDEA",
        borderTop: "0.5px solid rgba(0,0,0,0.06)",
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
              gap: 0,
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
                transform: isPop ? "scale(1.08)" : "scale(1)",
                transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
              }}
            >
              {tab.icon(isActive)}
              {/* Unread badge for alerts */}
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: ACTIVE,
                    border: "1.5px solid #F0EDEA",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {/* Active indicator dot */}
            {isActive && (
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: ACTIVE,
                  marginTop: 4,
                }}
              />
            )}
            {!isActive && (
              <span style={{ width: 4, height: 4, marginTop: 4 }} />
            )}
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
